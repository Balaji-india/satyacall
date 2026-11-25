# Person B (Balaji) — Frontend: 4 screens + audio capture
You own: `frontend/`. Branch: `b/frontend`. Also: demo video + screenshots.

## Paste this into your new Claude chat (attach PLAN.md, DETECTIF_API.md, PERSON_B.md)
> I'm Person B on a 2-person hackathon team building SatyaCall (DetectifAI Track 3). Read PLAN.md, DETECTIF_API.md and PERSON_B.md fully before writing code. Build ONLY the frontend in `frontend/`, task by task (B1→B7), calling the backend exactly as specified in the API contract (PLAN.md §5) — my teammate builds that backend in a separate chat. Never call DetectifAI directly from the browser (the API key stays on the backend). No fake data, no hard-coded or random scores: every number on screen must come from the backend response. Every result card must show evidence plus a next step, never a bare "FRAUD". Keep code simple so I can explain it to judges. After each task, tell me exactly how to test it.

## Setup
`npm create vite@latest frontend -- --template react` · `npm i peerjs recharts react-router-dom` · Tailwind.
`frontend/.env` → `VITE_API_URL=http://<A-laptop-IP>:8000`, `VITE_WS_URL=ws://<A-laptop-IP>:8000`.
Run `npm run dev -- --host` so the other laptop can open it.

## Audio rules (important — get these right)
- **Each clip must be a complete file.** Create a NEW `MediaRecorder` per clip, record 10 s, `stop()`, upload the blob (`audio/webm;codecs=opus`). Do NOT use `start(timeslice)` chunks — only the first chunk has the WebM header and the API rejects the rest.
- Agent console records the **remote** stream (the customer's voice as received over the call), not its own mic.
- Clip length **10 s** (config constant). Upload while recording the next clip (one upload in flight at a time).
- `/app` mic capture: `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` so a caller on speakerphone isn't filtered out.
- Mic works only on `localhost` or HTTPS. For the other laptop: Chrome `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add `http://<IP>:5173`.

## Tasks (in order)
**B1 Skeleton** — routes `/call`, `/agent`, `/app`, `/enroll`; shared `api.js` (fetch helpers for every endpoint in §5) and `ws.js`.
**B2 Call** — PeerJS: `/agent` creates peer `agent-desk`; `/call` (customer) calls it, or agent calls `customer-<id>` for outbound. Mute + hang up. (If PeerJS cloud is blocked: `npx peer --port 9000` and point both pages to it.)
**B3 Clip recorder** — on `/agent`, MediaRecorder loop on the remote stream → 10 s blobs → `POST /api/calls/{id}/clip` with `t_start/t_end`. Add a "download last clip" button to prove capture works. **Must send a real clip to A's backend by CP1 (10:45).**
**v3 note:** timeline clips are Aletheia-only (`speaker.decision = "not_checked"`). Show a separate **Identity badge** (`not_checked` / `match` / `no_match`, from `ClipResult.identity` or the Say-It-Back result). Show `score` vs `threshold` in tooltips. Show credits balance prominently and keep demo calls short. Add a "Pause monitoring" toggle that stops uploading clips (saves credits).

**B4 Agent console UI** (main screen — spend the most time here):
- Top: claimed customer selector (from `GET /api/people`, role customer) + Start/End call; call state badge (VERIFYING / VERIFIED / WATCH / ALERT); credits balance.
- Centre: **trust timeline** (Recharts) — one bar/point per clip, coloured green/amber/red/grey(skipped); tooltip = Aletheia verdict + score ("higher = more likely AI"), Eidos decision + similarity ("−1..1, not a %"). ALERT banner "Possible handover / voice change".
- Right: request panel — choose `action_type`, fill payee/amount etc. → `POST /action` → if `say_it_back`: show the sentence big, "Record confirmation (10 s)" (records the remote stream) → `POST /say-it-back` → result card (approved / retry / fallback with next steps: OTP via bank system, callback on number on file).
- Bottom: evidence drawer (raw JSON per check), "Export evidence" (`GET /evidence`), "Was this right? ✓ / ✗" per check → `POST /api/feedback`.
- Live updates via WebSocket `clip_result` / `state_change` / `say_it_back_result`.
**B5 Enroll page** — form (name, role, phone or employee ID + department), record 25 s (show countdown; API needs 15–60 s with ≥10 s speech), submit, show samples count; list enrolled people. Hint: "Record a second sample over a call or another device."
**B6 Customer bank app `/app`** — logged-in customer selector; "Verify This Caller" → employee ID input → record 10 s from mic (caller on speakerphone) → `POST /api/verify-caller` → green "Verified: <name>, <department>" or red "We can't confirm this caller" + big "Call bank's official number" button; list which checks passed/failed.
**B7 Polish + demo assets** — loading/error states ("check unavailable" when a verdict is `error`), mobile-friendly `/app`, screenshots, 2-minute demo video of the 6 scenes.

## Test checklist (A runs this on your part after each merge)
- Two laptops connect on a call; agent hears customer
- Downloaded clip plays back and is ~10 s
- Timeline fills with real verdicts; colours match status; tooltips show raw values
- Say-It-Back flow end to end, incl. retry and fallback card
- `/app` result for "no outbound call" shows call-log failure clearly
- Nothing on screen is hard-coded
