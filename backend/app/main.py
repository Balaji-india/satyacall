"""SatyaCall backend: FastAPI app, routes and WebSocket (PLAN.md §5)."""
import asyncio
import hashlib
import json
import re
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


# ---------- A3: enrollment ----------

SPEAKER_ID = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")   # DetectifAI's allowed speaker_id format


def slug(text: str) -> str:
    """'Balaji Keerthi' -> 'balaji-keerthi' (used for customer speaker ids)."""
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


@app.post("/api/people/enroll")
async def enroll_person(
    file: UploadFile = File(...),
    person_id: str = Form(...),
    display_name: str = Form(...),
    role: Literal["customer", "agent"] = Form(...),
    phone: Optional[str] = Form(None),
    employee_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
):
    """Enroll one 15–60 s voice sample. Speaker ids: customers cust-<slug>, agents emp-<employee_id> (PLAN §3).
    Calling again for the same person adds a sample (DetectifAI max 5; we use 1–2 to save credits)."""
    if role == "agent":
        if not employee_id:
            raise HTTPException(400, "employee_id is required for an agent")
        speaker_id = f"emp-{employee_id.strip()}"
    else:
        speaker_id = f"cust-{slug(person_id)}"
    if not SPEAKER_ID.match(speaker_id):
        raise HTTPException(400, f"invalid speaker id {speaker_id!r}: use letters, digits, _ . : -")

    audio = await file.read()
    if not audio:
        raise HTTPException(400, "empty file")

    result = await detectif.enroll(speaker_id, display_name, audio, file.filename)
    if result["error"]:
        # Pass DetectifAI's real error through (e.g. 409 too_many_samples, 422 not enough speech).
        status = result["status_code"] if 400 <= result["status_code"] < 600 else 502
        raise HTTPException(status, result["error"])

    body = result["body"]
    samples = (body.get("speaker") or {}).get("samples")              # real count from DetectifAI
    speech_seconds = (body.get("quality") or {}).get("speech_seconds")

    db.conn.execute(
        """INSERT INTO people (person_id, speaker_id, display_name, role, phone, employee_id, department,
                               samples, speech_seconds, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(person_id) DO UPDATE SET
               speaker_id = excluded.speaker_id, display_name = excluded.display_name, role = excluded.role,
               phone = excluded.phone, employee_id = excluded.employee_id, department = excluded.department,
               samples = excluded.samples, speech_seconds = excluded.speech_seconds""",
        (person_id, speaker_id, display_name, role, phone, employee_id, department,
         samples, speech_seconds, db.now()),
    )
    # Evidence row for the enrollment too (operation id, quality, credits, raw response).
    db.conn.execute(
        "INSERT INTO evidence (call_id, kind, clip_sha256, data_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (None, "enroll", hashlib.sha256(audio).hexdigest(),
         json.dumps({"time": db.now(), "speaker_id": speaker_id, "operation_id": body.get("operation_id"),
                     "latency_ms": result["latency_ms"], "credits_balance": detectif.last_balance(), "raw": body}),
         db.now()),
    )
    db.conn.commit()
    return {"person_id": person_id, "speaker_id": speaker_id, "samples": samples, "speech_seconds": speech_seconds}


@app.get("/api/people")
async def list_people():
    """Everyone enrolled through SatyaCall (phone only for customers, employee fields only for agents)."""
    rows = db.conn.execute("SELECT * FROM people ORDER BY created_at").fetchall()
    people = []
    for r in rows:
        p = {"person_id": r["person_id"], "speaker_id": r["speaker_id"], "display_name": r["display_name"],
             "role": r["role"], "samples": r["samples"]}
        if r["role"] == "customer":
            p["phone"] = r["phone"]
        else:
            p["employee_id"], p["department"] = r["employee_id"], r["department"]
        people.append(p)
    return people


# ---------- calls ----------

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


# ---------- A5: actions ----------

ActionType = Literal["balance", "card_status", "statement", "complaint_status", "branch_info",
                     "add_payee", "change_mobile", "change_email", "change_address", "reset_credentials",
                     "raise_limit", "large_transfer", "card_new_address", "unblock"]


class NewAction(BaseModel):
    action_type: ActionType
    params: dict = {}


@app.post("/api/calls/{call_id}/action")
async def request_action(call_id: str, body: NewAction):
    """Agent asks for an action -> { risk, decision: allow | say_it_back | fallback, sentence? }."""
    call = get_call(call_id)
    if call["ended_at"]:
        raise HTTPException(409, "call has ended")

    # Say-It-Back needs: an enrolled customer (Eidos compares against them), credits above the
    # floor (v3 rule 7), and fewer than 2 failed attempts on this call (v3 rule 5 -> then fallback).
    customer = db.conn.execute(
        "SELECT display_name FROM people WHERE role = 'customer' AND (person_id = ? OR speaker_id = ?)",
        (call["claimed_customer_id"], call["claimed_customer_id"]),
    ).fetchone()
    balance = detectif.last_balance()
    above_floor = balance is None or balance >= config.CREDIT_FLOOR
    failed_twice = db.conn.execute(
        "SELECT 1 FROM say_it_back WHERE call_id = ? AND attempt >= 2 AND pass = 0", (call_id,)
    ).fetchone() is not None
    can_say_it_back = bool(customer) and above_floor and not failed_twice

    risk, result = decision.action_decision(body.action_type, call["state"], can_say_it_back)

    sentence = None
    if result == "say_it_back":
        try:
            sentence = decision.say_it_back_sentence(customer["display_name"], body.action_type, body.params)
        except ValueError as e:
            raise HTTPException(400, str(e))

    db.conn.execute(
        "INSERT INTO actions (call_id, action_type, params_json, risk, decision, sentence, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (call_id, body.action_type, json.dumps(body.params), risk, result, sentence, db.now()),
    )
    db.conn.commit()

    response = {"risk": risk, "decision": result}
    if sentence:
        response["sentence"] = sentence
    return response
