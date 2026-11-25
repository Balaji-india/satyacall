# SatyaCall — a two-way voice trust layer for bank calls

Ananth AI Hackathon 2K26 × DetectifAI · Track 03 **The Trust Layer** · built today by a team of 2.

## The problem
AI can clone a voice from a few seconds of audio, and live voice changers let one person sound like another on a call. In India the fraud runs both ways: fraudsters call **the bank** pretending to be the customer, and call **customers** pretending to be "bank officers". Checking *who* is speaking is fooled by a good clone; checking whether a voice is *AI-generated* misses a real human impostor. **One check is not enough.**

## What SatyaCall does
**Bank side — is this really our customer?**
1. **Passive check + live timeline.** While the customer talks normally, the agent console sends a 10 s clip at a time to **Aletheia** (deepfake detection). Each clip is plotted green / amber / red, so a voice changer switched on mid-call shows up.
2. **Say-It-Back for risky requests.** Adding a payee, changing the mobile number, raising a limit and the like always ask the customer to repeat one sentence, e.g. *"I, Balaji Keerthi, want to add Ramesh Kumar as a payee for twenty-five thousand rupees today."* It passes only if **the words match** (speech-to-text), **Eidos** says the voice is the enrolled customer (`match`), and **Aletheia** says it is a real human voice (`real`). One retry is allowed, then **fallback**.
3. **Honest result + next step.** We never show a bare "FRAUD". Every result shows the evidence (verdicts, scores vs DetectifAI's thresholds, raw responses, exportable as JSON) and a next step. On failure the next step is *"Do not proceed. Use the bank's existing OTP to the registered number, or call back on the number on file."*

**Customer side — is this really my bank? ("Verify This Caller")**
The customer receives a "bank" call, opens the bank app, enters the caller's employee ID and records 10 s of the caller on speakerphone. It shows **VERIFIED** only if:
1. the **bank's own call log** has an active outbound call from that employee to this customer, and
2. **Eidos** matches the employee's enrolled voice, and
3. **Aletheia** says the voice is real.

If there is no call-log entry, the voice check is skipped and the answer is *"Can't confirm, hang up and call the official number."*

## How we use DetectifAI's two models
| Model | Endpoint | Where we use it |
|---|---|---|
| **Aletheia** (deepfake detection) | `POST /v1/deepfake/detect` | every 10 s timeline clip |
| **Eidos** (speaker verification) + Aletheia in one request | `POST /v1/speakers/verify` with `detect_deepfake=true` | Say-It-Back attempts, Verify This Caller |
| Eidos enrollment | `POST /v1/speakers/enroll` | one 20–30 s sample per person |
| Feedback | `POST /v1/operations/{id}/feedback` | "Was this right?" button (free) |

- **We decide with DetectifAI's own `verdict` (real/fake) and `decision` (match/no_match)**, as its docs instruct. We set no thresholds of our own. Scores, similarity (−1..1, not a percentage) and DetectifAI's thresholds are shown as evidence only.
- **Credit-aware design** (from our measured costs: detect 20, enroll 200, verify+deepfake ≈ 520 credits):
  - Timeline clips use Aletheia only.
  - Eidos runs only where identity matters (Say-It-Back, Verify This Caller).
  - Say-It-Back checks the words locally first and skips the 520-credit voice check if they don't match.
  - Verify This Caller skips the voice check when the call log already fails.
  - Eidos is refused below a credit floor.
- Audio that is silent or has too little speech (DetectifAI `422`) is marked **skipped**, not scored. It costs nothing.

## Architecture
```
/call  (customer)  ⇄  WebRTC (PeerJS)  ⇄  /agent (agent console)
                                         └─ 10 s clips of the caller → POST /api/calls/{id}/clip
/app   (customer bank app) → 10 s of the caller + employee ID → POST /api/verify-caller
/enroll (admin) → 20–30 s voice sample → POST /api/people/enroll
            all → FastAPI backend (backend/) → DetectifAI REST
                  ↳ WebSocket /ws/calls/{id} pushes results live to /agent
```
- **Backend:** Python 3.11, FastAPI, httpx, SQLite, faster-whisper `base` (Say-It-Back speech-to-text, runs locally), rapidfuzz.
- **Frontend:** React + Vite, Tailwind, PeerJS, MediaRecorder.
- The full API contract is in `docs/PLAN.md` §5, and the DetectifAI fields we rely on are in `docs/DETECTIF_API.md`.

## Run it
**Backend** (Windows CMD, from `backend/`):
```
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt -r requirements-stt.txt
copy .env.example .env          (then put DETECTIF_API_KEY=... in .env — never commit it)
download_model.cmd              (faster-whisper "base" model, ~145 MB, for Say-It-Back)
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
- `.env` settings:
  - `DEV_REPLAY=true` reuses DetectifAI's stored result for an identical clip during development (0 credits).
  - `EIDOS_ON_FIRST_CLIP=false` and `CREDIT_FLOOR=600` are the credit rules described above.
- Tests: `.venv\Scripts\python -m pip install -r requirements-dev.txt` then `.venv\Scripts\python -m pytest -q tests`. They spend 0 credits, because they replay DetectifAI's real recorded responses from `docs/api-samples/`.
- Say-It-Back audio is sent as WAV (16 kHz mono). Our venue laptop's security policy blocks the ffmpeg libraries needed to decode webm locally. DetectifAI itself accepts webm, which the timeline clips use.

**Frontend:** see `frontend/` (`npm install`, `npm run dev`). Point it at the backend's `http://<LAN-IP>:8000`.

**Evaluation:** `backend\.venv\Scripts\python eval\run_eval.py` writes `eval/results.md`. It scores every real check from our calls against labels we wrote by hand in `eval/labels.json`, at 0 credits.

## Demo scenes
| # | Scene | Status |
|---|---|---|
| 1 | Customer asks for balance → green timeline, no friction | shown |
| 2 | Customer adds a payee → Say-It-Back passes → approved | shown |
| 3 | Teammate claims to be the customer, asks to change mobile → Say-It-Back: Eidos `no_match` → fallback | shown |
| 4 | Consented clone of the customer's voice played into the call | **cut** (time and credits). The detection path is built and is the same Aletheia check used on every clip, but we did not test it on a clone, so we make no claim about it |
| 5 | Customer verifies, then hands the laptop to the teammate mid-call (handover) | **cut** (time and credits). Same logic: a new voice asking for a risky action still has to pass Say-It-Back |
| 6a | Agent places an outbound call → customer's Verify This Caller → VERIFIED | shown |
| 6b | Teammate calls the customer on WhatsApp claiming ID 4521 → no call-log entry → NOT VERIFIED | shown |

## Measured results
`eval/run_eval.py` writes **[eval/results.md](eval/results.md)** once we have labelled who spoke on each call (being added after the demo). It covers every scored check from our rehearsal and demo calls: Aletheia false alarms and misses, Eidos false rejects and false accepts, and latency. **Misses are included.** The sample is small and recorded in live conditions (laptop mics over a WebRTC call on a phone hotspot), so these numbers describe our demo, not the models in general. We did not test cloned voices (scene 4 was cut).

## Limitations (honest)
- **Phone and call-channel audio** is less reliable for both models. Some of our 10 s clips had too little speech and were skipped. One real voice scored very close to Aletheia's threshold (it was still judged `real`).
- **Identity is not checked on every clip.** To save credits the timeline uses Aletheia only, so a *real* human impostor looks green on the timeline. They are caught at Say-It-Back (Eidos `no_match`), which every risky action requires.
- **Live voice changers** could in principle say the Say-It-Back sentence. Aletheia still scores that clip and the timeline keeps checking, but we did not test a voice changer.
- **Eidos is strict by design:** a genuine customer recorded on a different device or channel can be rejected. Say-It-Back allows one retry, then falls back to the bank's OTP. It never locks the customer out.
- **Small test set from two consenting people.** No cloned-voice tests.
- DetectifAI's own guidance applies: *a verdict or match is a signal, not proof; have a person review decisions that matter.*

## Team
Two people, built today: backend + evaluation (`backend/`, `eval/`) and frontend (`frontend/`). Only our own, consented voices were used.
