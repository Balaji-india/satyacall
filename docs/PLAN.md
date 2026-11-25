# SatyaCall — Final Plan v2 (25 Nov 2026)
Ananth AI Hackathon 2K26 × DetectifAI · CMRIT · **Track 03: The Trust Layer** · team of 2
Read with: `docs/DETECTIF_API.md` (real API facts) and your own brief (`docs/PERSON_A.md` or `docs/PERSON_B.md`).

## Roles (updated 09:55)
- **Person A = teammate → backend** (`backend/`, `eval/`, branch `a/backend`). Backend runs on his laptop.
- **Person B = Balaji → frontend** (`frontend/`, branch `b/frontend`). Balaji owns the GitHub repo.
- **One DetectifAI account only:** the backend uses Balaji's API key (shared privately, put in `backend/.env`). Enrolled speakers belong to one account — a second account would not see them.
- Demo roles are unchanged: Balaji = customer, teammate = bank agent / impostor.

## v3 — CREDIT-AWARE CHANGES (10:05, from our real test calls) — these override anything below
Measured on our account: **Aletheia detect = 20 credits · Eidos enroll = 200 · Eidos verify ≈ 500 (+20 if detect_deepfake=true)**. Start balance 5000, now **4260**. Eidos on every clip is unaffordable.
1. **Timeline clips use Aletheia only** (`POST /v1/deepfake/detect`, 20 credits per 10 s clip).
2. **Eidos (verify + detect_deepfake, ~520) runs only at:** (a) the first clip of a call — only if config `EIDOS_ON_FIRST_CLIP=true`, default **false** until we get more credits; (b) every Say-It-Back attempt; (c) Verify This Caller — and **only if the call-log check passed** (no call record → skip the voice check, save 520).
3. **Identity is a separate badge** on the agent console: `not_checked` / `match` / `no_match`, set by (a) or (b). Clip colours (green/amber/red) now describe voice authenticity only.
4. **Handover (scene 5) is caught at Say-It-Back:** the new person asks for a high-risk action → Say-It-Back → Eidos `no_match` → fallback. Continuous Aletheia still catches a voice changer switched on mid-call.
5. **Say-It-Back max 2 attempts** (each ~520). Scene 3 can be shown with 1 attempt + fallback.
6. **Dev testing must not burn credits:** reuse the same `Idempotency-Key` for the same test clip → DetectifAI returns the stored real result at 0 credits. Fresh keys only for real demo calls.
7. **Backend tracks `credits.balance`** from every response and refuses Eidos calls below a safety floor (config `CREDIT_FLOOR=600`), returning `speaker.decision = "error"` with message "credit floor reached".
8. **Responses also include `threshold`** (deepfake 0.62, similarity 0.53 in our tests) → show "score vs threshold" as evidence; still decide with `verdict`/`decision`.
9. **ASK THE ORGANISERS / DetectifAI (Tarini) FOR MORE HACKATHON CREDITS NOW.** If granted, set `EIDOS_ON_FIRST_CLIP=true`.
10. Evaluation (A9): Aletheia on ~20 test clips (~400 credits); Eidos only on the clips the demo already produces (log them) — state the small sample size honestly.
11. **Skip second enrollment samples** unless credits are topped up.

Rough demo budget with defaults: per call ≈ 18 clips/3 min × 20 = 360 + Say-It-Back 520 → keep demo calls short (≤ 90 s).

## What changed in v2 (after reading the official model docs)
1. **Clips are 10 s, not 6 s.** Aletheia false alarms drop from 4.2% (4 s) to 0.45% (10 s) in DetectifAI's tests. Applies to call windows, Say-It-Back and Verify This Caller.
2. **One API call per clip:** `POST /v1/speakers/verify` with `detect_deepfake=true` returns Eidos + Aletheia together.
3. **Decide with the API's own verdicts** (`verdict` real/fake, `decision` match/no_match), as the docs instruct. Our own thresholds are gone; scores/similarity are shown as evidence only. Aletheia `score` = likelihood of AI (higher = more fake). Eidos `similarity` is −1..1, not a percentage.
4. **No ffmpeg:** WebM/Opus is accepted. Each uploaded blob must be a complete file → frontend restarts MediaRecorder for each clip.
5. **Enrollment = 2 samples per person, 20–30 s each** (limit 15–60 s, ≥10 s speech): one on laptop mic, one over our WebRTC call (same channel as real calls).
6. **New: "Was this right?" button** on results → DetectifAI feedback endpoint (free). Used in evaluation too.
7. **422 insufficient speech is free** → silent clips are "skipped", not errors.
8. **Stretch:** DetectifAI live call stream (WebSocket) as an upgrade of the timeline, only after the core works and after reading its docs.
9. Credits balance comes back on every response → shown in the agent console.

---

## 1. Problem
AI clones a voice from seconds of audio; live voice changers impersonate people on calls. Speaker verification alone is fooled by clones; deepfake detection alone misses new generators → **one check is not enough.** In India fraud runs both ways: fraudsters call banks as the customer, and call customers as "bank officers" (SBI, PNB, HDFC have issued public warnings). Pitch number: India recorded 28.15 lakh cyber-fraud complaints and Rs 22,495 crore losses in 2025 (cite source in Reddit post).

## 2. Concept: two-way voice trust layer for bank calls
### Bank side (core — Track 3)
- **L1 Passive check:** customer's natural speech → 10 s clip → verify(claimed customer) + deepfake in one call. Low-risk calls need nothing else.
- **L2 Continuous timeline:** consecutive 10 s clips through the call, plotted live. Catches voice changer mid-call or phone handover.
- **L3 Say-It-Back** (high-risk requests, or ALERT): customer repeats their own request, ~10 s:
  > "To confirm, please say: I, Balaji Keerthi, want to add Ramesh Kumar as a payee for twenty-five thousand rupees today."
  Checks: speech-to-text word match + Eidos match + Aletheia real. One retry.
- **L4 Honest result + fallback:** evidence (verdicts, scores, raw response) + next step. Fail → "Do not proceed. Use the bank's existing OTP to the registered number, or call back on the number on file." We never send OTPs and never show a bare "FRAUD".

### Customer side — "Verify This Caller"
Customer gets a "bank" call → bank app → enter caller's employee ID → record 10 s of the caller on speakerphone → checks: **(1) bank call log** has an active outbound call from that employee to this customer (strongest), **(2) Eidos** match vs that employee, **(3) Aletheia** real. Result: "Verified: Priya, Card Services" or "Can't confirm — hang up and call the official number." Question is "is this really my bank?", not "is this a bot?".

### Cancelled
Random phrase on every call · AI voice-bot guard · fraudster watchlist (no real data) · Twilio/real phone network · sending OTPs · "is it a bot?" check · our own score thresholds (v2).

## 3. Decision rules
**speaker_id scheme:** customers `cust-<slug>` (e.g. `cust-balaji`), agents `emp-<employee_id>` (e.g. `emp-4521`).

**Per clip (bank side):**
| Status | Rule |
|---|---|
| GREEN | `deepfake.verdict == "real"` AND `decision == "match"` AND no segment with verdict `fake` |
| AMBER | both pass but ≥ 1 segment `fake` (mixed), OR one check returned an error (show "check unavailable") |
| RED | `deepfake.verdict == "fake"` OR `decision == "no_match"` |
| SKIPPED | 422 (too little speech) — free, not scored |

**Call state:** VERIFYING (no scored clip) → VERIFIED (first scored clip GREEN) · WATCH (latest AMBER) · ALERT (2 consecutive RED, or any RED after VERIFIED → banner "Possible handover / voice change"). From ALERT, back to VERIFIED only after a passed Say-It-Back.

**Actions:** high-risk = add payee · change mobile/email · change address · reset password/PIN/MPIN · raise limit · large transfer · card to new address · unblock card/UPI → **always Say-It-Back**. Low-risk = balance · card status · statement · complaint status · branch info → allowed unless ALERT (then Say-It-Back).

**Say-It-Back PASS:** text match ≥ 0.85 (rapidfuzz token_set_ratio/100 after lowercasing, removing punctuation, numbers as words or digits both accepted) AND `decision == match` AND `deepfake.verdict == real`. Attempt 2 fails → FALLBACK.

**Verify This Caller:** VERIFIED only if call-log entry (employee → this customer, active, started ≤ 30 min ago) AND match vs `emp-<id>` AND real. No call-log entry → NOT VERIFIED regardless of voice.

**Evidence log:** every check stores time, call_id, clip SHA-256, operation_ids, verdicts, scores, raw response, decision, latency, credits balance. Exportable JSON.

## 4. Architecture
```
/call (customer)  ⇄ WebRTC (PeerJS) ⇄  /agent (agent console)
                                       records REMOTE stream → 10 s webm clips → POST /api/calls/{id}/clip
/app (customer bank app) → 10 s mic clip + employee ID → POST /api/verify-caller
/enroll (admin)  → 20–30 s samples → POST /api/people/enroll
                     all → FastAPI backend (A's laptop) → DetectifAI REST
                                 ↳ WebSocket /ws/calls/{id} pushes results to /agent
```
Stack: backend Python 3.11 · FastAPI · uvicorn · httpx · SQLite · faster-whisper (`base`) · rapidfuzz. Frontend React + Vite · Tailwind · PeerJS · MediaRecorder · Recharts. One GitHub monorepo: `backend/` (A), `frontend/` (B), `eval/` (A), `docs/` (shared).

## 5. SHARED API CONTRACT (change only with both agreeing; either person commits the change to `docs/` on main, then both merge main)
Base `http://<backend-host>:8000`. Audio = multipart field `file` (webm/opus or wav).

### Objects
```json
// Check
{ "authenticity": { "verdict": "real|fake|error", "score": 0.07, "threshold": 0.62, "segments": [{"start":0,"end":4,"score":0.06,"verdict":"real"}], "operation_id": "op_...", "error": null },
  "speaker":      { "decision": "match|no_match|not_checked|error", "similarity": 0.74, "threshold": 0.53, "operation_id": "op_...", "error": null },
  "raw": { } }

// ClipResult  (Check fields + these)
{ "clip_id": "k_12", "call_id": "c_3", "t_start": 30.0, "t_end": 40.0,
  "authenticity": {...}, "speaker": {...}, "raw": {...},
  "status": "green|amber|red|skipped", "call_state": "verifying|verified|watch|alert",
  "identity": "not_checked|match|no_match",   // call-level identity badge (v3)
  "latency_ms": 840, "clip_sha256": "...", "credits_balance": 120 }
// v3: timeline clips normally have speaker.decision = "not_checked" (Aletheia only).
```
### Endpoints
| Method & path | Body | Returns |
|---|---|---|
| `GET /api/health` | — | `{ ok, detectif_reachable, credits_balance }` |
| `POST /api/people/enroll` | file, person_id, display_name, role (`customer`/`agent`), phone (customer), employee_id + department (agent) | `{ person_id, speaker_id, samples, speech_seconds }` |
| `GET /api/people` | — | `[ { person_id, speaker_id, display_name, role, phone?, employee_id?, department?, samples } ]` |
| `POST /api/calls` | JSON `{ direction: "inbound"\|"outbound", claimed_customer_id, agent_id }` | `{ call_id, started_at }` (outbound writes call log) |
| `POST /api/calls/{id}/end` | — | `{ ended_at }` |
| `POST /api/calls/{id}/clip` | file, t_start, t_end | `ClipResult` |
| `POST /api/calls/{id}/action` | JSON `{ action_type, params: { payee_name?, amount?, new_mobile?, ... } }` | `{ risk: "low"\|"high", decision: "allow"\|"say_it_back"\|"fallback", sentence? }` |
| `POST /api/calls/{id}/say-it-back` | file, attempt (1\|2) | `{ pass, transcript, expected, text_match, authenticity, speaker, next_step: "approved"\|"retry"\|"fallback" }` |
| `GET /api/calls/{id}` | — | `{ call, clips: [ClipResult], actions, say_it_back, state }` |
| `GET /api/calls/{id}/evidence` | — | JSON file download |
| `POST /api/verify-caller` | file, employee_id, customer_id | `{ verified, checks: { call_log: { pass, detail }, speaker, authenticity }, employee: { name, department } \| null, next_step }` |
| `POST /api/feedback` | JSON `{ operation_id, correct, label?, note? }` | DetectifAI feedback response |

`action_type` values: `balance`, `card_status`, `statement`, `complaint_status`, `branch_info`, `add_payee`, `change_mobile`, `change_email`, `change_address`, `reset_credentials`, `raise_limit`, `large_transfer`, `card_new_address`, `unblock`.

### WebSocket `ws://<host>:8000/ws/calls/{call_id}`
Server → client: `{ "type": "clip_result", "data": ClipResult }` · `{ "type": "state_change", "data": { from, to, reason } }` · `{ "type": "say_it_back_result", "data": {...} }`

### Data rules
No hard-coded/random scores. DetectifAI error → `"error"` verdict + message, UI shows "check unavailable". Clip length 10 s (config). Upload clips only while the call is live.

## 6. Demo script (real, consented voices)
Balaji = enrolled customer `cust-balaji`. Teammate = enrolled agent `emp-4521`, also plays impostor.
1. Balaji asks balance → GREEN, no friction.
2. Balaji adds payee → Say-It-Back passes → approved.
3. Teammate claims to be Balaji, asks to change mobile → RED → Say-It-Back fails → fallback.
4. Balaji's **consented** clone played into the call → Aletheia fake; clone can't say the sentence → fallback.
5. Balaji verifies, hands laptop to teammate mid-call → ALERT "possible handover", high-risk blocked.
6a. Agent places outbound call from console → Balaji's Verify This Caller → VERIFIED.
6b. Teammate calls Balaji's real phone on WhatsApp claiming ID 4521 → NOT VERIFIED (no call-log entry).

## 7. Team process & merge protocol
- Balaji (Person B) creates repo `satyacall` and adds the teammate (Person A). Copy this `docs/` folder + root `CLAUDE.md` in the first commit.
- Branches: A → `a/backend`, B → `b/frontend`. **Only touch your own folder.** `docs/` changes only by agreement.
- **Checkpoints = merges:** both push, then on `main`: `git pull && git merge a/backend && git merge b/frontend && git push`; then each runs `git merge main` into their branch. Disjoint folders → no conflicts.
- After each merge: the person who didn't write a part tests it (checklist in each brief).
- Whoever finishes early takes the top item from the shared backlog (§9). At 2:30 each explains the other's half (Rule 06).

## 8. Timeline (today)
| Time | A (backend) | B (frontend) |
|---|---|---|
| now–10:00 | **Together:** API key → curl one 10 s clip to `/v1/deepfake/detect`, enroll one 20 s sample, verify with `detect_deepfake=true` → save real JSON to `docs/api-samples/`. Check credits. Repo + branches. | same |
| 10:00–10:45 | A1–A4 | B1–B3 |
| **10:45 CP1** | B's real 10 s clip → A's `/clip` → real verdicts. Merge. Enroll both voices (2 samples each). | |
| 10:45–12:15 | A5–A8 | B4–B5 |
| **12:15 CP2** | Scenes 1–3 end to end. Merge. | |
| 12:20–1:30 | Lunch (one member must stay at venue) | |
| 1:30–2:30 | A9–A10 + test set + eval | B6–B7 + polish |
| **2:30 CP3 — freeze** | Rehearse all scenes; swap-explain code | |
| 2:30–3:30 | README + results | demo video + screenshots → **Reddit post live (together)** |
| 3:30–4:00 | Google form (team details + Reddit link), rehearse pitch | |
If behind at 12:15: cut 6a/6b to 6b only; never cut Say-It-Back or the timeline.

## 9. Shared backlog
1. Test set: 10 s clips, both voices, over WebRTC AND WhatsApp-on-speaker; consented clones of one voice. 2. Reddit post draft (r/fintech or r/cybersecurity; follow subreddit rules). 3. Pitch script. 4. Error/loading states. 5. Stretch: live call stream upgrade; Hindi Say-It-Back; PDF evidence export.

## 10. Risks
| Risk | Fix |
|---|---|
| Mic blocked on `http://<LAN-IP>` | Chrome `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add the frontend URL; or open pages via `localhost` on each laptop |
| College Wi-Fi blocks laptop↔laptop | phone hotspot |
| PeerJS cloud blocked | `npx peer --port 9000` locally |
| Echo cancellation removes the caller's voice in `/app` | `getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})` |
| Credits run out (2 checks per clip) | show balance; clip interval config; stop when call ends |
| 429 rate limit | respect `Retry-After`, one in-flight request per call |
| Genuine voice rejected (Eidos is strict) | 2 enrollment samples incl. one over the call; Say-It-Back retry; fallback, never block |
| Live voice changer passes Say-It-Back | Aletheia still scores that clip + timeline; say this limit openly |

## 11. Rules checklist (must all be true at 4 PM)
☐ Uses Aletheia + Eidos via API (MCP only as dev tool) ☐ only our own consented voices/clones ☐ every result = evidence + next step ☐ Reddit post live, link in Google form ☐ repo + 2-min demo video + short README ☐ everything built today ☐ both can explain all code ☐ college IDs on us.

## 12. Judge answers
- Friction: "Most customers never notice us; risky requests get one confirmation sentence that replaces security questions; a failed check falls back to OTP, never a lockout."
- Two-way: "Track 3 asks the bank to trust the caller; we also let the customer trust the bank — same two models plus the bank's own call log."
- Limits: "A live voice changer can still say the sentence, so Aletheia scores that clip and the timeline keeps checking. Our measured error rates, including misses, are in the README."
