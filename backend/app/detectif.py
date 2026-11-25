"""The ONLY file that talks to DetectifAI (docs/DETECTIF_API.md).

Every function returns real API data mapped to the contract's Check object (PLAN.md §5):
  { "authenticity": {verdict, score, threshold, segments, operation_id, error},
    "speaker":      {decision, similarity, threshold, operation_id, error},
    "raw":          <full DetectifAI response> }
We never invent a score: if DetectifAI fails, the verdict/decision is "error" with its message.
"""
import asyncio
import hashlib
import re
import time
import uuid

import httpx

from . import config, db

TIMEOUT_S = 60

# Browser clips are webm/opus; test files are often wav. DetectifAI accepts both.
CONTENT_TYPES = {"webm": "audio/webm", "wav": "audio/wav", "mp3": "audio/mpeg", "ogg": "audio/ogg",
                 "opus": "audio/ogg", "m4a": "audio/mp4", "flac": "audio/flac"}


# ---------- small helpers ----------

def _headers() -> dict:
    # The key goes only into this header. Never print or log it.
    return {"Authorization": f"Bearer {config.DETECTIF_API_KEY}"}


def _file_part(file_bytes: bytes, filename: str):
    ext = (filename or "clip.webm").rsplit(".", 1)[-1].lower()
    return (filename or "clip.webm", file_bytes, CONTENT_TYPES.get(ext, "application/octet-stream"))


def _idempotency_key(path: str, file_bytes: bytes, extra: str = "") -> str:
    """DEV_REPLAY=true: same clip + same endpoint -> same key -> DetectifAI returns the stored
    real result for 0 credits (v3 rule 6). Otherwise a fresh uuid per request (demo)."""
    if config.DEV_REPLAY:
        digest = hashlib.sha256(path.encode() + b"|" + extra.encode() + b"|" + file_bytes).digest()
        return str(uuid.UUID(bytes=digest[:16]))
    return str(uuid.uuid4())


def _error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def _error_of(body: dict, status: int) -> dict:
    """Pull DetectifAI's stable error.code + message out of an error response."""
    err = body.get("error") if isinstance(body, dict) else None
    if isinstance(err, dict):
        return {"code": err.get("code") or f"http_{status}", "message": err.get("message") or ""}
    return {"code": f"http_{status}", "message": "DetectifAI returned an error"}


def record_balance(body) -> None:
    """Every DetectifAI response may carry credits.balance -> remember the latest real value."""
    credits = body.get("credits") if isinstance(body, dict) else None
    if isinstance(credits, dict) and credits.get("balance") is not None:
        db.set_meta("credits_balance", credits["balance"])


def last_balance():
    """Last balance DetectifAI actually reported (None if we have not seen one yet)."""
    value = db.get_meta("credits_balance")
    return float(value) if value is not None else None


async def _send(method: str, path: str, *, idem: str | None = None, **kwargs):
    """One HTTP call to DetectifAI. On 429/503 waits Retry-After once (max 10 s) and retries
    with the SAME Idempotency-Key, so a retry is never charged twice.
    Returns (status_code, body_dict, latency_ms). status_code 0 = network failure."""
    headers = _headers()
    if idem:
        headers["Idempotency-Key"] = idem
    start = time.perf_counter()
    r = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(base_url=config.DETECTIF_BASE_URL, timeout=TIMEOUT_S) as client:
                r = await client.request(method, path, headers=headers, **kwargs)
        except httpx.HTTPError as e:
            latency = round((time.perf_counter() - start) * 1000)
            return 0, _error_body("network_error", f"DetectifAI unreachable ({type(e).__name__})"), latency
        if r.status_code in (429, 503) and attempt == 0:
            try:
                wait = float(r.headers.get("Retry-After", "2"))
            except ValueError:
                wait = 2.0
            await asyncio.sleep(min(wait, 10))
            continue
        break
    latency = round((time.perf_counter() - start) * 1000)
    try:
        body = r.json()
    except ValueError:
        body = _error_body("bad_response", f"HTTP {r.status_code}, response was not JSON")
    record_balance(body)
    return r.status_code, body, latency


# ---------- mapping DetectifAI -> contract Check ----------

def _authenticity(df: dict, operation_id=None) -> dict:
    """df = Aletheia result: detect's `result`, or verify's embedded `deepfake` object."""
    verdict = df.get("verdict")
    if verdict not in ("real", "fake"):
        return _authenticity_error({"code": "unexpected_response", "message": "no real/fake verdict in response"})
    return {
        "verdict": verdict,                     # DECIDE WITH THIS
        "score": df.get("score"),               # evidence only: higher = more likely AI
        "threshold": df.get("threshold"),       # evidence only
        "segments": df.get("segments") or [],
        "operation_id": operation_id or df.get("operation_id"),
        "error": None,
    }


def _authenticity_error(error: dict, operation_id=None) -> dict:
    return {"verdict": "error", "score": None, "threshold": None, "segments": [],
            "operation_id": operation_id, "error": error}


def _speaker(result: dict, operation_id) -> dict:
    decision = result.get("decision")
    if decision not in ("match", "no_match"):
        return _speaker_error({"code": "unexpected_response", "message": "no match/no_match decision in response"})
    return {
        "decision": decision,                   # DECIDE WITH THIS
        "similarity": result.get("similarity"), # evidence only: -1..1, NOT a percentage
        "threshold": result.get("threshold"),
        "operation_id": operation_id,
        "error": None,
    }


def _speaker_error(error: dict, operation_id=None) -> dict:
    return {"decision": "error", "similarity": None, "threshold": None, "operation_id": operation_id, "error": error}


def speaker_not_checked() -> dict:
    """v3: timeline clips are Aletheia only, so the speaker part is explicitly 'not_checked'."""
    return {"decision": "not_checked", "similarity": None, "threshold": None, "operation_id": None, "error": None}


def _outcome(check: dict, status: int, latency_ms: int) -> dict:
    """What every check function returns to main.py."""
    return {
        "check": check,
        "skipped": status == 422,        # unusable audio (e.g. too little speech): free, not scored
        "status_code": status,
        "latency_ms": latency_ms,
        "credits_balance": last_balance(),
    }


# ---------- public functions ----------

async def ping() -> bool:
    """Proves the key works: GET /v1/speakers?limit=1 (free, no audio)."""
    if not config.DETECTIF_API_KEY:
        return False
    status, _, _ = await _send("GET", "/v1/speakers", params={"limit": 1})
    return status == 200


async def detect(file_bytes: bytes, filename: str) -> dict:
    """Aletheia only (20 credits per 10 s clip). Used for every timeline clip (v3 rule 1)."""
    path = "/v1/deepfake/detect"
    status, body, latency = await _send("POST", path, idem=_idempotency_key(path, file_bytes),
                                        files={"file": _file_part(file_bytes, filename)})
    if status == 200:
        authenticity = _authenticity(body.get("result") or {}, body.get("operation_id"))
    else:
        authenticity = _authenticity_error(_error_of(body, status), body.get("operation_id"))
    check = {"authenticity": authenticity, "speaker": speaker_not_checked(), "raw": body}
    return _outcome(check, status, latency)


async def verify_with_deepfake(speaker_id: str, file_bytes: bytes, filename: str) -> dict:
    """Eidos verify + Aletheia in ONE request (~520 credits). Only for: first clip (if
    EIDOS_ON_FIRST_CLIP), Say-It-Back, Verify This Caller. Refused below CREDIT_FLOOR (v3 rule 7)."""
    balance = last_balance()
    if balance is not None and balance < config.CREDIT_FLOOR:
        err = {"code": "credit_floor", "message": "credit floor reached"}
        check = {"authenticity": _authenticity_error(err), "speaker": _speaker_error(err), "raw": {}}
        return _outcome(check, 0, 0)

    path = "/v1/speakers/verify"
    status, body, latency = await _send(
        "POST", path, idem=_idempotency_key(path, file_bytes, speaker_id),
        files={"file": _file_part(file_bytes, filename)},
        data={"speaker_id": speaker_id, "detect_deepfake": "true"},
    )

    if status == 200:
        speaker = _speaker(body.get("result") or {}, body.get("operation_id"))
        df = body.get("deepfake")
        if isinstance(df, dict) and isinstance(df.get("error"), dict):
            # Only the deepfake half failed: keep the verification, mark authenticity as error.
            authenticity = _authenticity_error(_error_of(df, status), df.get("operation_id"))
        elif isinstance(df, dict):
            authenticity = _authenticity(df)
        else:
            authenticity = _authenticity_error({"code": "missing_deepfake", "message": "no deepfake result returned"})
    else:
        # Verification failed (e.g. 404 unknown speaker). If the deepfake half completed,
        # DetectifAI returns it under `partial`, so we still use that real verdict.
        speaker = _speaker_error(_error_of(body, status), body.get("operation_id"))
        partial = body.get("partial") if isinstance(body.get("partial"), dict) else {}
        df = partial.get("deepfake") if isinstance(partial.get("deepfake"), dict) else partial
        if df.get("verdict") in ("real", "fake"):
            authenticity = _authenticity(df)
        else:
            authenticity = _authenticity_error(_error_of(body, status))

    check = {"authenticity": authenticity, "speaker": speaker, "raw": body}
    return _outcome(check, status, latency)


async def enroll(speaker_id: str, display_name: str, file_bytes: bytes, filename: str) -> dict:
    """Eidos enroll (200 credits). Returns the raw result; A3 maps it to the contract.
    Like verify, refused below CREDIT_FLOOR so we never spend the demo budget (v3 rule 7)."""
    balance = last_balance()
    if balance is not None and balance < config.CREDIT_FLOOR:
        return {"status_code": 402, "body": {}, "latency_ms": 0,
                "error": {"code": "credit_floor", "message": "credit floor reached"}}
    path = "/v1/speakers/enroll"
    status, body, latency = await _send(
        "POST", path, idem=_idempotency_key(path, file_bytes, speaker_id),
        files={"file": _file_part(file_bytes, filename)},
        data={"speaker_id": speaker_id, "display_name": display_name},
    )
    return {"status_code": status, "body": body, "latency_ms": latency,
            "error": None if status == 200 else _error_of(body, status)}


OPERATION_ID = re.compile(r"^op_[A-Za-z0-9]+$")


async def feedback(operation_id: str, correct: bool, label: str | None = None, note: str | None = None) -> dict:
    """Free: tells DetectifAI whether a result was right ('Was this right?' button + eval)."""
    if not OPERATION_ID.match(operation_id or ""):
        return {"status_code": 400, "body": _error_body("invalid_operation_id", "operation_id must look like op_...")}
    payload = {"correct": bool(correct)}
    if label in ("real", "fake"):
        payload["label"] = label
    if note:
        payload["note"] = note[:500]
    status, body, _ = await _send("POST", f"/v1/operations/{operation_id}/feedback", json=payload)
    return {"status_code": status, "body": body}
