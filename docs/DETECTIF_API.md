# DetectifAI API — the facts we build on
Condensed from the official docs (platform.detectif.ai/docs/deepfake-detection and /speaker-verification, read 25 Nov 2026). **Do not guess fields — use exactly these.** Full docs for any page: add `.md` to its path, index at `https://platform.detectif.ai/llms.txt`.

Base URL `https://platform.detectif.ai` · Auth header `Authorization: Bearer $DETECTIF_API_KEY` · recommended header `Idempotency-Key: <uuid>` (same key on retry = stored result, no second charge) · all uploads `multipart/form-data`, audio in field `file`.

**Accepted audio:** WAV, MP3, FLAC, OGG/Opus, **WebM**, M4A/AAC, AIFF, ≤ 100 MB → browser `audio/webm;codecs=opus` blobs can be sent directly (no ffmpeg needed), as long as each blob is a complete file.

---

## 0. MEASURED ON OUR ACCOUNT (25 Nov, real responses in docs/api-samples/)
| Call | Credits |
|---|---|
| `/v1/deepfake/detect` (9.5 s clip) | 20 |
| `/v1/speakers/enroll` (24.9 s clip) | 200 |
| `/v1/speakers/verify` + `detect_deepfake=true` (9.5 s) | 520 total (deepfake part `credits_charged: 20`) |
Balance after tests: 4260 of 5000. Same `Idempotency-Key` + same request = stored result, 0 credits.
Real responses contain extra fields not in the docs: `result.threshold` (Aletheia, 0.62) and `result.threshold` (Eidos, 0.53). The embedded `deepfake` object puts `verdict`, `score`, `threshold`, `segments` directly on `deepfake` (no `result` wrapper). Our test: verdict `real`, score 0.0026; decision `match`, similarity 0.84. Latency 0.5–0.9 s.

## 1. Aletheia — deepfake detection
`POST /v1/deepfake/detect` · field `file` · scope `deepfake:detect`

Length: ≤ 300 s, at least 2 s of speech. **Send ≥ 10 s of speech when possible.** DetectifAI's own English tests: real voices flagged fake in **4.2%** of checks on the first 4 s vs **0.45%** on the first 10 s. Under 4 s is least reliable. Phone-quality audio is less reliable. Best on English and Hindi.

Response (key fields):
```json
{
  "request_id": "req_...", "operation_id": "op_...", "object": "deepfake.detection",
  "result": {
    "verdict": "real",            // ALWAYS "real" or "fake" — DECIDE WITH THIS
    "score": 0.0731,              // 0..1, HIGHER = MORE LIKELY AI-GENERATED (not the decision)
    "score_semantics": "...",
    "label": "genuine", "is_synthetic": false,   // older wording, ignore
    "duration_seconds": 10.4, "scored_seconds": 10.4,
    "segments": [ { "start": 0, "end": 4, "score": 0.061, "verdict": "real" }, ... ]  // overlapping parts
  },
  "model": { "name": "aletheia", "version": "2026.10" },
  "credits": { "charged": 1, "balance": 123 },   // balance null on unlimited plan
  "latency_ms": 312, "idempotent_replay": false
}
```
Silence/music/< 2 s speech → `422 insufficient_speech`, **not charged** → treat as "skipped".

Feedback (free): `POST /v1/operations/{operation_id}/feedback` JSON `{ "correct": bool, "label": "real"|"fake" (optional), "note": "≤500 chars" (optional) }`.
Re-fetch any result for 30 days: `GET /v1/operations/{operation_id}`.

## 2. Eidos — speaker verification
**Enroll** `POST /v1/speakers/enroll` · fields `file`, `speaker_id`, `display_name` (optional) · scope `speakers:enroll`
- Recording **15–60 s**, at least **10 s speech**. Speaker created on first sample. **Max 5 samples** (6th → `409 too_many_samples`).
- Enroll **2–3 samples from different sessions/devices** → more reliable.
- `speaker_id`: 1–64 chars `^[A-Za-z0-9_.:-]{1,64}$`.
- Response: `speaker { speaker_id, display_name, samples, created_at, updated_at }`, `quality { speech_seconds, duration_seconds }`, `credits`, `latency_ms`.

**Verify** `POST /v1/speakers/verify` · fields `file`, `speaker_id`, `detect_deepfake` (bool, default false) · scope `speakers:verify` (+ `deepfake:detect` if detect_deepfake)
- Recording **3–60 s**, at least **2 s speech**. Unknown speaker → `404`.
```json
{
  "operation_id": "op_...", "object": "speaker.verification", "speaker_id": "cust-balaji",
  "result": {
    "decision": "match",          // "match" | "no_match" — DECIDE WITH THIS
    "similarity": 0.7412,         // -1..1, higher = more alike. NOT a percentage/probability
    "similarity_semantics": "...", "duration_seconds": 4.1
  },
  "deepfake": {                    // null unless detect_deepfake=true
    "verdict": "real", "score": 0.07, "segments": [...], "scored_seconds": 10.0,
    "operation_id": "op_...", "credits_charged": 1, "model": {...}
    // OR on failure: "deepfake": { "error": { "type", "code", "message", "param" }, "operation_id" }
  },
  "model": { "name": "eidos", ... }, "credits": { "charged": 2, "balance": 121 }, "latency_ms": 450
}
```
- **`detect_deepfake=true` = both models on the same clip in ONE request.** The two checks are separate: if only the deepfake part fails you still get the verification plus `deepfake.error`; if verification fails but deepfake completed you get the error plus `partial`.
- Eidos "rarely accepts the wrong person, so a genuine speaker recorded in different conditions is rejected more often" → expect some false rejections of genuine people; enroll multiple sessions; our Say-It-Back retry + fallback covers this.

Manage: `GET /v1/speakers` (list), `GET /v1/speakers/{id}`, `DELETE /v1/speakers/{id}`.

## 3. Live call streams (stretch only)
`wss://platform.detectif.ai/v1/stream?checks=deepfake,verify&speaker_id=<id>` — one WebSocket per call: early verdict, live verdicts every few seconds, final verdict at end; verification usually within 3–5 s of speech. **Message/audio format is NOT in our notes** — read `https://platform.detectif.ai/docs/live-call-streams.md` before using it.

## 4. Errors (all endpoints)
400 invalid · 401 bad key · **402 not enough credits** · 403 scope/unverified · 404 not found · 408 slow upload · 409 conflict / too many samples · 413 > 100 MB · 415 bad format · **422 unusable audio (too short/long/silent)** · **429 rate limited → wait `Retry-After` s** · 500/502/504 no credits used, retry later · 503 busy, wait `Retry-After`. Error body has a stable `error.code`.

## 5. MCP (dev tool only)
`claude mcp add --transport http detectif https://platform.detectif.ai/mcp --header "Authorization: Bearer $DETECTIF_API_KEY"`
Tools: `detect_deepfake`, `enroll_speaker`, `verify_speaker` (has `detect_deepfake`), `list_speakers`, `delete_speaker`, `get_operation`. Use them to sanity-check clips; the product itself uses REST.

## 6. Rules from the docs we must show in the UI
"A verdict/match is a signal, not proof. Use it with other checks, and have a person review decisions that matter." → every result card shows evidence + a next step, never a bare "FRAUD".
