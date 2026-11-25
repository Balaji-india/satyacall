# Person A (teammate) — Backend "Trust Engine" + evaluation
You own: `backend/`, `eval/`, edits to `docs/`. Branch: `a/backend`.

## Paste this into your new Claude chat (attach PLAN.md, DETECTIF_API.md, PERSON_A.md)
> I'm Person A on a 2-person hackathon team building SatyaCall (DetectifAI Track 3). Read PLAN.md, DETECTIF_API.md and PERSON_A.md fully before writing code. Build ONLY the backend in `backend/` (and `eval/`), task by task (A1→A10), following the API contract in PLAN.md §5 exactly — my teammate's frontend is built against it in a separate chat. Use only DetectifAI fields listed in DETECTIF_API.md and decide with `verdict`/`decision`, never our own score thresholds. No fake data, no hard-coded or random scores, no simulated results. Keep the code simple and commented so I can explain every line to judges. After each task, tell me exactly how to test it with curl.

## Setup
```
backend/
  app/main.py          # FastAPI app, routes, CORS (allow all origins for the hackathon), WebSocket
  app/detectif.py      # DetectifAI client — the ONLY file that talks to DetectifAI
  app/decision.py      # §3 rules: clip status, call state, action risk, Say-It-Back
  app/stt.py           # faster-whisper transcription + text match
  app/db.py            # SQLite (people, calls, call_log, clips, actions, say_it_back, evidence)
  .env                 # DETECTIF_API_KEY=...   (in .gitignore — NEVER commit)
  requirements.txt     # fastapi uvicorn[standard] httpx python-multipart python-dotenv faster-whisper rapidfuzz
eval/run_eval.py, eval/clips/, eval/results.md
```
Run: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` (0.0.0.0 so B's laptop can reach it).

## ⚠ v3 credit rules (read PLAN.md "v3" section first)
Timeline clips → `detect()` only (20 credits). Eidos `verify_with_deepfake()` (~520) only on: first clip if `EIDOS_ON_FIRST_CLIP=true` (default false), Say-It-Back attempts (max 2), Verify This Caller after call-log passes. Track `credits.balance`; below `CREDIT_FLOOR` (600) refuse Eidos with a clear error. While developing, send the SAME Idempotency-Key for the same test clip (stored result, 0 credits) — e.g. key = sha256 of the file bytes + endpoint, behind a config flag `DEV_REPLAY=true`; turn it OFF for the demo.

## Tasks (in order)
**A1 Skeleton** — FastAPI, CORS, `/api/health` (calls `GET /v1/speakers?limit=1` to prove the key works), SQLite tables.
**A2 DetectifAI client** (`detectif.py`, httpx AsyncClient, timeout 60 s, Idempotency-Key uuid per request, respect 429 `Retry-After` once):
- `enroll(speaker_id, display_name, file_bytes, filename)` → `/v1/speakers/enroll`
- `verify_with_deepfake(speaker_id, file_bytes, filename)` → `/v1/speakers/verify` with `detect_deepfake=true`
- `detect(file_bytes, filename)` → `/v1/deepfake/detect`
- `feedback(operation_id, correct, label, note)`
- Map to the contract's `Check` object; keep `raw`; 422 → `skipped`; other errors → `"error"` with `error.code`/message. Record `credits.balance`.
**A3 Enrollment** — `POST /api/people/enroll`, `GET /api/people`; speaker_id `cust-<slug>` / `emp-<employee_id>`; same person can enroll up to 5 samples (we use 2).
**A4 Clip endpoint** — `POST /api/calls`, `/end`, `POST /api/calls/{id}/clip`: SHA-256 the bytes → `detect()` (plus `verify_with_deepfake` on the first clip only if `EIDOS_ON_FIRST_CLIP`) → clip status (authenticity only) + call `identity` badge → rolling call state (§3) → store → push `clip_result` (+ `state_change`) on WebSocket `/ws/calls/{id}`. **Must work with a real 10 s clip by CP1 (10:45).**
**A5 Actions** — `POST /api/calls/{id}/action`: risk table, decision, Say-It-Back sentence builder (≈10 s when spoken; uses customer display name + params; amounts written in words, e.g. "twenty-five thousand rupees").
**A6 Say-It-Back** — `POST /api/calls/{id}/say-it-back`: faster-whisper `base` (`language="en"`, load model once at startup) transcribes; normalise (lowercase, strip punctuation, digits↔words both OK); rapidfuzz `token_set_ratio ≥ 85` + verify_with_deepfake → pass/retry/fallback; a pass in ALERT state resets to VERIFIED.
**A7 Call log + Verify This Caller** — outbound `POST /api/calls` writes call_log; `POST /api/verify-caller` per §3.
**A8 Evidence + feedback** — evidence rows for every check; `GET /api/calls/{id}` and `/evidence` (download); `POST /api/feedback` proxy.
**A9 Evaluation** (`eval/run_eval.py`) — runs every clip in `eval/clips/<label>/` (labels: `genuine_balaji`, `genuine_teammate`, `impostor`, `clone`) through the same client → table of verdicts/decisions, accuracy, false-positive and false-reject counts, latency → `eval/results.md` **including misses**. Optionally send feedback for each.
**A10 README** — problem, what it does, how both models are used, run instructions, measured results from eval, limitations (phone audio, live voice changers, Eidos strictness, small test set).

## Test checklist (B runs this on your part after each merge)
- `curl http://<host>:8000/api/health` → ok + credits balance
- enroll a 20 s file → samples 1; again → samples 2
- start call, send a 10 s clip of the enrolled voice → green; teammate's voice → red; silence → skipped
- add_payee action → say_it_back + sentence; correct spoken clip → approved; wrong words → retry
- verify-caller with no outbound call → NOT verified (call_log fails)

## Stretch (only after CP3 is green)
Live call stream upgrade (`wss://platform.detectif.ai/v1/stream?checks=deepfake,verify&speaker_id=...`) — read `https://platform.detectif.ai/docs/live-call-streams.md` first; do not guess its message format.
