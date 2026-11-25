"""A8 tests: call record, evidence download, feedback proxy. 0 credits — clips use a silent WAV
(free 422) and feedback is answered by a stand-in HTTP response (no live feedback is sent).
Run from backend/:  .venv/Scripts/python -m pytest -q
"""
import io
import os
import tempfile
import wave

os.environ.setdefault("DB_PATH", os.path.join(tempfile.mkdtemp(), "test_ev.db"))
os.environ["STT_PRELOAD"] = "false"

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import main  # noqa: E402


def silent_wav():
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\0\0" * 160000)
    return buf.getvalue()


def test_call_record_and_evidence_download():
    with TestClient(main.app) as c:
        call_id = c.post("/api/calls", json={"direction": "inbound", "claimed_customer_id": "balaji"}).json()["call_id"]
        c.post(f"/api/calls/{call_id}/clip", files={"file": ("s.wav", silent_wav(), "audio/wav")},
               data={"t_start": 0, "t_end": 10})
        c.post(f"/api/calls/{call_id}/action", json={"action_type": "balance", "params": {}})
        rec = c.get(f"/api/calls/{call_id}").json()
        assert set(rec) == {"call", "clips", "actions", "say_it_back", "state"}
        assert len(rec["clips"]) == 1 and rec["actions"][0]["decision"] == "allow"
        r = c.get(f"/api/calls/{call_id}/evidence", headers={"Origin": "http://x"})
        assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
        assert r.headers.get("access-control-allow-origin") == "*"
        ev = r.json()
        assert ev["evidence"][0]["kind"] == "clip" and ev["evidence"][0]["clip_sha256"] == rec["clips"][0]["clip_sha256"]
        assert c.get("/api/calls/c_nope").status_code == 404


def test_feedback_forwarded(monkeypatch):
    seen = {}

    async def fake_request(self, method, path, **kwargs):
        seen.update(method=method, path=path, json=kwargs.get("json"))
        return httpx.Response(200, json={"object": "feedback", "operation_id": "op_abc123", "correct": False})
    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    with TestClient(main.app) as c:
        r = c.post("/api/feedback", json={"operation_id": "op_abc123", "correct": False, "label": "fake"})
        assert r.status_code == 200
        assert seen == {"method": "POST", "path": "/v1/operations/op_abc123/feedback",
                        "json": {"correct": False, "label": "fake"}}
        assert c.post("/api/feedback", json={"operation_id": "../x", "correct": True}).status_code == 400
