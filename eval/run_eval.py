"""A9 — SatyaCall evaluation. Writes eval/results.md, INCLUDING misses and false alarms.

Two sources of real DetectifAI results:

1. log  (default, 0 credits): every check the app already ran (rehearsals + demo), read from the
   evidence log in backend/satyacall.db (read-only). Ground truth = eval/labels.json, written by us
   (who actually spoke on each call). Unlabelled calls are listed but NOT scored. v3 rule 10.

2. clips (--clips --spend, costs credits): every file in eval/clips/<label>/ is sent to Aletheia
   detect (20 credits per 10 s clip) with the same client the app uses. Labels:
   genuine_balaji, genuine_teammate, impostor (all real human voices -> expected "real"), clone (-> "fake").

We score DetectifAI's own verdict/decision only (never our own threshold on the score).

Run from the repo root:
    backend\\.venv\\Scripts\\python eval\\run_eval.py
    backend\\.venv\\Scripts\\python eval\\run_eval.py --clips --spend      (spends credits!)
"""
import argparse
import asyncio
import json
import sqlite3
import statistics
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVAL = ROOT / "eval"
DB = ROOT / "backend" / "satyacall.db"
REAL_VOICE_LABELS = {"genuine_balaji", "genuine_teammate", "impostor"}


def person(text) -> str:
    """'cust-balaji' / 'balaji' / 'emp-4521' / '4521' -> 'balaji' / '4521'."""
    t = str(text or "").strip().lower()
    for prefix in ("cust-", "emp-"):
        if t.startswith(prefix):
            t = t[len(prefix):]
    return t


# ---------- 1. evidence log ----------

def load_log():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)      # read-only: never touches the app's data
    con.row_factory = sqlite3.Row
    calls = {r["call_id"]: dict(r) for r in con.execute("SELECT * FROM calls")}
    rows = []
    for r in con.execute("SELECT kind, call_id, data_json FROM evidence WHERE kind IN "
                         "('clip', 'say_it_back', 'verify_caller') ORDER BY id"):
        d = json.loads(r["data_json"])
        rows.append({"kind": r["kind"], "call_id": r["call_id"], "time": d.get("time", "")[:19],
                     "auth": d.get("authenticity") or {}, "spk": d.get("speaker") or {},
                     "latency_ms": d.get("latency_ms"), "decision": d.get("decision")})
    return calls, rows


def score_log(calls, rows, labels):
    """Each check -> expected vs DetectifAI's verdict/decision. Returns per-check lines + tallies."""
    lines, auth, eidos, lat, unlabelled, not_scored = [], [], [], [], set(), []
    for r in rows:
        if r["call_id"] is None:
            continue        # Verify This Caller with no call-log match: Eidos was never run (nothing to score)
        lab = labels.get(r["call_id"])
        if not lab or lab.get("exclude"):
            if not lab:
                unlabelled.add(r["call_id"])
            continue
        call = calls.get(r["call_id"], {})
        # Who was being checked: the customer side (clip, say_it_back) or the agent (verify_caller).
        if r["kind"] == "verify_caller":
            voice, claimed = lab.get("agent_voice"), person(call.get("agent_id"))
        else:
            voice, claimed = lab.get("customer_voice"), person(call.get("claimed_customer_id"))
        if not voice:
            unlabelled.add(r["call_id"])
            continue
        synthetic = voice == "clone"
        verdict, decision = r["auth"].get("verdict"), r["spk"].get("decision")
        line = {"call": r["call_id"], "kind": r["kind"], "time": r["time"], "voice": voice, "claimed": claimed,
                "verdict": verdict, "score": r["auth"].get("score"), "decision": decision,
                "similarity": r["spk"].get("similarity"), "latency_ms": r["latency_ms"], "notes": []}
        if verdict in ("real", "fake"):
            expected = "fake" if synthetic else "real"
            ok = verdict == expected
            auth.append((ok, expected))
            line["notes"].append("Aletheia OK" if ok else ("Aletheia MISS (clone passed)" if synthetic
                                                           else "Aletheia FALSE ALARM (real voice flagged)"))
        else:
            err = (r["auth"].get("error") or {}).get("code")
            not_scored.append(err or "error")
            line["notes"].append(f"Aletheia not scored ({err})")
        if decision in ("match", "no_match"):
            same = person(voice) == claimed or (voice == "aravindh" and claimed == "4521")
            expected = "match" if same and not synthetic else "no_match"
            ok = decision == expected
            eidos.append((ok, expected))
            line["notes"].append("Eidos OK" if ok else ("Eidos FALSE REJECT (genuine rejected)" if expected == "match"
                                                        else "Eidos FALSE ACCEPT (wrong person accepted)"))
        if r["latency_ms"] and verdict in ("real", "fake"):
            lat.append(r["latency_ms"])
        lines.append(line)
    return lines, auth, eidos, lat, unlabelled, not_scored


# ---------- 2. test clips (spends credits) ----------

async def run_clips():
    sys.path.insert(0, str(ROOT / "backend"))
    from app import detectif                     # the same client the app uses
    results = []
    for folder in sorted((EVAL / "clips").glob("*")):
        if not folder.is_dir():
            continue
        for f in sorted(folder.iterdir()):
            if f.suffix.lower() not in (".wav", ".webm", ".m4a", ".mp3", ".ogg"):
                continue
            out = await detectif.detect(f.read_bytes(), f.name)
            a = out["check"]["authenticity"]
            results.append({"label": folder.name, "file": f.name, "verdict": a["verdict"], "score": a["score"],
                            "skipped": out["skipped"], "latency_ms": out["latency_ms"],
                            "operation_id": a["operation_id"], "credits": out["credits_balance"]})
            print(f"{folder.name}/{f.name}: {a['verdict']} {a['score']}")
    return results


# ---------- report ----------

def rate(pairs):
    return f"{sum(ok for ok, _ in pairs)}/{len(pairs)}" if pairs else "0/0"


def fmt(x, nd=3):
    return "—" if x is None else (f"{x:.{nd}f}" if isinstance(x, float) else str(x))


def write_report(lines, auth, eidos, lat, unlabelled, not_scored, clip_results, out_path):
    real_checks = [ok for ok, exp in auth if exp == "real"]
    fake_checks = [ok for ok, exp in auth if exp == "fake"]
    genuine = [ok for ok, exp in eidos if exp == "match"]
    impostor = [ok for ok, exp in eidos if exp == "no_match"]
    out = [f"# SatyaCall — measured results", "",
           f"Generated {datetime.now():%Y-%m-%d %H:%M} by `eval/run_eval.py` from real DetectifAI responses "
           "(our app's evidence log + labels we wrote in `eval/labels.json`). "
           "We score DetectifAI's own `verdict` / `decision`, never our own threshold.", "",
           "**Small sample, live conditions (laptop mics over a WebRTC call on a phone hotspot). "
           "These numbers describe our demo, not the models in general.**", "",
           "## Summary", "",
           "| Check | Result |", "|---|---|",
           f"| Aletheia on real human voices (should be `real`) | {sum(real_checks)}/{len(real_checks)} correct — "
           f"**{len(real_checks) - sum(real_checks)} false alarm(s)** |",
           f"| Aletheia on cloned voices (should be `fake`) | {sum(fake_checks)}/{len(fake_checks)} caught — "
           f"**{len(fake_checks) - sum(fake_checks)} miss(es)**"
           + (" (no clone clips tested: scene 4 was cut)" if not fake_checks else "") + " |",
           f"| Eidos, genuine speaker (should `match`) | {sum(genuine)}/{len(genuine)} — "
           f"**{len(genuine) - sum(genuine)} false reject(s)** |",
           f"| Eidos, wrong person (should `no_match`) | {sum(impostor)}/{len(impostor)} — "
           f"**{len(impostor) - sum(impostor)} false accept(s)** |",
           f"| Checks not scored (DetectifAI error / too little speech) | {len(not_scored)}"
           + (f" ({', '.join(sorted(set(not_scored)))})" if not_scored else "") + " |",
           f"| Latency (DetectifAI round trip, scored checks) | "
           + (f"median {statistics.median(lat):.0f} ms, max {max(lat):.0f} ms, n={len(lat)}" if lat else "—") + " |",
           ""]
    if unlabelled:
        out += [f"Not scored because nobody labelled who spoke: {', '.join(sorted(c or 'none' for c in unlabelled))}.", ""]
    out += ["## Every scored check", "",
            "| Call | Check | Time (UTC) | Who spoke | Claimed | Aletheia verdict (score) | Eidos decision (similarity) | Latency | Outcome |",
            "|---|---|---|---|---|---|---|---|---|"]
    for l in lines:
        out.append(f"| {l['call']} | {l['kind']} | {l['time'][11:19]} | {l['voice']} | {l['claimed']} | "
                   f"{l['verdict']} ({fmt(l['score'], 4)}) | {l['decision'] or '—'} ({fmt(l['similarity'])}) | "
                   f"{fmt(l['latency_ms'])} ms | {'; '.join(l['notes'])} |")
    if clip_results:
        out += ["", "## Test clips (Aletheia detect)", "", "| Label | File | Verdict | Score | Latency | Outcome |",
                "|---|---|---|---|---|---|"]
        for c in clip_results:
            exp = "real" if c["label"] in REAL_VOICE_LABELS else "fake"
            res = "skipped (too little speech)" if c["skipped"] else ("OK" if c["verdict"] == exp else
                  ("MISS" if exp == "fake" else "FALSE ALARM") if c["verdict"] in ("real", "fake") else "error")
            out.append(f"| {c['label']} | {c['file']} | {c['verdict']} | {fmt(c['score'], 4)} | {c['latency_ms']} ms | {res} |")
    else:
        out += ["", "_Separate test-clip set (eval/clips/) not run: we kept the remaining credits for the live demo._"]
    out += ["", "## Limits we know about", "",
            "- Very small sample from two people; no confidence intervals are meaningful at this size.",
            "- Timeline clips are checked by Aletheia only (v3 credit rule), so identity is checked only at "
            "Say-It-Back and Verify This Caller.",
            "- Eidos is strict by design: a genuine speaker recorded on a different channel can be rejected "
            "(our Say-It-Back retry and OTP fallback cover this).",
            "- A live voice changer could still say the Say-It-Back sentence; Aletheia scores that clip and the "
            "timeline keeps checking.", ""]
    out_path.write_text("\n".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clips", action="store_true", help="also run eval/clips/<label>/* through Aletheia")
    ap.add_argument("--spend", action="store_true", help="required with --clips: confirms spending credits")
    ap.add_argument("--labels", default=str(EVAL / "labels.json"), help="labels file (default eval/labels.json)")
    ap.add_argument("--out", default=str(EVAL / "results.md"), help="report file (default eval/results.md)")
    args = ap.parse_args()
    labels = json.loads(Path(args.labels).read_text(encoding="utf-8"))
    labels = {k: v for k, v in labels.items() if not k.startswith("_")}
    calls, rows = load_log()
    lines, auth, eidos, lat, unlabelled, not_scored = score_log(calls, rows, labels)
    clip_results = []
    if args.clips:
        if not args.spend:
            sys.exit("--clips spends ~20 credits per clip: add --spend to confirm")
        clip_results = asyncio.run(run_clips())
    write_report(lines, auth, eidos, lat, unlabelled, not_scored, clip_results, Path(args.out))
    print(f"scored {len(lines)} checks ({len(auth)} Aletheia, {len(eidos)} Eidos); "
          f"unlabelled calls: {sorted(c or 'none' for c in unlabelled) or 'none'} -> {args.out}")


if __name__ == "__main__":
    main()
