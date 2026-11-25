"""SatyaCall backend: FastAPI app, routes and WebSocket (PLAN.md §5)."""
import asyncio
import hashlib
import json
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config, db, decision, detectif


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()  # create SQLite tables on startup
    yield


app = FastAPI(title="SatyaCall Trust Engine", lifespan=lifespan)

# Hackathon: frontend runs on the teammate's laptop -> allow all origins.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------- WebSocket hub: pushes results to the agent console ----------

class Hub:
    def __init__(self):
        self.rooms = defaultdict(set)          # call_id -> connected websockets

    async def send(self, call_id: str, message: dict) -> None:
        for ws in list(self.rooms[call_id]):
            try:
                await ws.send_json(message)
            except Exception:
                self.rooms[call_id].discard(ws)  # browser tab closed


hub = Hub()

# One clip at a time per call: keeps state changes in order and avoids 429s (PLAN §10).
call_locks = defaultdict(asyncio.Lock)


@app.websocket("/ws/calls/{call_id}")
async def call_socket(ws: WebSocket, call_id: str):
    await ws.accept()
    hub.rooms[call_id].add(ws)
    try:
        while True:
            await ws.receive_text()            # we only push; ignore anything the client sends
    except WebSocketDisconnect:
        hub.rooms[call_id].discard(ws)


# ---------- helpers ----------

def get_call(call_id: str) -> dict:
    row = db.conn.execute("SELECT * FROM calls WHERE call_id = ?", (call_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"call {call_id} not found")
    return dict(row)


def customer_speaker_id(claimed_customer_id: str) -> str:
    """Enrolled customer -> their speaker_id (e.g. cust-balaji); else use the id as given."""
    row = db.conn.execute(
        "SELECT speaker_id FROM people WHERE person_id = ? OR speaker_id = ?",
        (claimed_customer_id, claimed_customer_id),
    ).fetchone()
    return row["speaker_id"] if row else claimed_customer_id


def save_evidence(call_id: str, kind: str, clip_sha256: str, outcome: dict, result_decision: str) -> None:
    """PLAN §3 evidence log: time, call, clip hash, operation ids, verdicts, scores, raw, decision, latency, credits."""
    check = outcome["check"]
    data = {
        "time": db.now(), "call_id": call_id, "clip_sha256": clip_sha256,
        "operation_ids": [i for i in (check["authenticity"]["operation_id"], check["speaker"]["operation_id"]) if i],
        "authenticity": check["authenticity"], "speaker": check["speaker"],
        "decision": result_decision, "latency_ms": outcome["latency_ms"],
        "credits_balance": outcome["credits_balance"], "raw": check["raw"],
    }
    db.conn.execute(
        "INSERT INTO evidence (call_id, kind, clip_sha256, data_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (call_id, kind, clip_sha256, json.dumps(data), data["time"]),
    )
    db.conn.commit()


# ---------- routes ----------

@app.get("/api/health")
async def health():
    """{ ok, detectif_reachable, credits_balance }. Balance = last value DetectifAI reported (or null)."""
    reachable = await detectif.ping()
    return {"ok": True, "detectif_reachable": reachable, "credits_balance": detectif.last_balance()}


class NewCall(BaseModel):
    direction: Literal["inbound", "outbound"]
    claimed_customer_id: Optional[str] = None
    agent_id: Optional[str] = None


@app.post("/api/calls")
async def start_call(body: NewCall):
    """Start a call. Outbound calls are also written to the bank's call log (used by Verify This Caller)."""
    count = db.conn.execute("SELECT COUNT(*) FROM calls").fetchone()[0]
    call_id, started_at = f"c_{count + 1}", db.now()
    db.conn.execute(
        "INSERT INTO calls (call_id, direction, claimed_customer_id, agent_id, started_at) VALUES (?, ?, ?, ?, ?)",
        (call_id, body.direction, body.claimed_customer_id, body.agent_id, started_at),
    )
    if body.direction == "outbound":
        db.conn.execute(
            "INSERT INTO call_log (call_id, employee_id, customer_id, started_at) VALUES (?, ?, ?, ?)",
            (call_id, body.agent_id, body.claimed_customer_id, started_at),
        )
    db.conn.commit()
    return {"call_id": call_id, "started_at": started_at}


@app.post("/api/calls/{call_id}/end")
async def end_call(call_id: str):
    get_call(call_id)
    ended_at = db.now()
    db.conn.execute("UPDATE calls SET ended_at = ? WHERE call_id = ?", (ended_at, call_id))
    db.conn.execute("UPDATE call_log SET ended_at = ? WHERE call_id = ?", (ended_at, call_id))
    db.conn.commit()
    return {"ended_at": ended_at}


@app.post("/api/calls/{call_id}/clip")
async def upload_clip(call_id: str, file: UploadFile = File(...), t_start: float = Form(...), t_end: float = Form(...)):
    """One 10 s clip of the caller -> DetectifAI -> ClipResult (+ pushed on the WebSocket)."""
    if get_call(call_id)["ended_at"]:
        raise HTTPException(409, "call has ended; clips are only accepted while the call is live")
    audio = await file.read()
    if not audio:
        raise HTTPException(400, "empty file")
    clip_sha256 = hashlib.sha256(audio).hexdigest()

    async with call_locks[call_id]:
        call = get_call(call_id)               # re-read inside the lock: state may have changed
        history = db.conn.execute(
            "SELECT status, result_json FROM clips WHERE call_id = ? ORDER BY rowid", (call_id,)
        ).fetchall()
        scored = [r for r in history if r["status"] != "skipped"]

        # v3 rule 1/2: timeline = Aletheia only. Eidos (+deepfake in the same request) only on the
        # first scored clip, and only if EIDOS_ON_FIRST_CLIP=true and we know who is claimed.
        use_eidos = (config.EIDOS_ON_FIRST_CLIP and not scored
                     and call["identity"] == "not_checked" and call["claimed_customer_id"])
        if use_eidos:
            outcome = await detectif.verify_with_deepfake(
                customer_speaker_id(call["claimed_customer_id"]), audio, file.filename)
        else:
            outcome = await detectif.detect(audio, file.filename)
        check = outcome["check"]

        status = decision.clip_status(check, outcome["skipped"])
        identity = decision.identity_from(check, call["identity"])
        was_verified = call["state"] == "verified" or any(
            json.loads(r["result_json"])["call_state"] == "verified" for r in history)
        previous_status = scored[-1]["status"] if scored else None
        new_state, reason = decision.next_call_state(call["state"], status, previous_status, was_verified)

        clip_result = {
            "clip_id": f"k_{len(history) + 1}", "call_id": call_id, "t_start": t_start, "t_end": t_end,
            "authenticity": check["authenticity"], "speaker": check["speaker"], "raw": check["raw"],
            "status": status, "call_state": new_state, "identity": identity,
            "latency_ms": outcome["latency_ms"], "clip_sha256": clip_sha256,
            "credits_balance": outcome["credits_balance"],
        }

        db.conn.execute(
            "INSERT INTO clips (clip_id, call_id, t_start, t_end, status, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (clip_result["clip_id"], call_id, t_start, t_end, status, json.dumps(clip_result), db.now()),
        )
        db.conn.execute("UPDATE calls SET state = ?, identity = ? WHERE call_id = ?", (new_state, identity, call_id))
        db.conn.commit()
        save_evidence(call_id, "clip", clip_sha256, outcome, status)

    await hub.send(call_id, {"type": "clip_result", "data": clip_result})
    if new_state != call["state"]:
        await hub.send(call_id, {"type": "state_change",
                                 "data": {"from": call["state"], "to": new_state, "reason": reason}})
    return clip_result
