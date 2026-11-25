"""Regression test for the CP1 bug: the 2nd call's first clip crashed with
'UNIQUE constraint failed: clips.clip_id' because clip ids were numbered per call.

Uses a temporary database and a SILENT WAV: DetectifAI answers 422 (silent_audio), which is
FREE, and the clip is still stored as 'skipped', so the insert path is fully exercised at 0 credits.
Run from backend/:  .venv/Scripts/python -m pytest -q
"""
import io
import os
import tempfile
import wave

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")  # never touch satyacall.db

from fastapi.testclient import TestClient  # noqa: E402

from app import decision, main  # noqa: E402


def silent_wav(seconds: int = 10) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\0\0" * 16000 * seconds)
    return buf.getvalue()


def new_call(client) -> str:
    r = client.post("/api/calls", json={"direction": "inbound", "claimed_customer_id": "cust-test", "agent_id": "4521"})
    assert r.status_code == 200
    return r.json()["call_id"]


def send_clip(client, call_id, t0):
    files = {"file": ("clip.wav", silent_wav(), "audio/wav")}
    return client.post(f"/api/calls/{call_id}/clip", files=files, data={"t_start": t0, "t_end": t0 + 10},
                       headers={"Origin": "http://frontend.test"})


def test_two_calls_get_distinct_clip_ids():
    with TestClient(main.app) as client:
        ids = []
        for _ in range(2):                       # call A, then call B (B used to crash)
            call_id = new_call(client)
            for t0 in (0, 10):
                r = send_clip(client, call_id, t0)
                assert r.status_code == 200, r.text
                body = r.json()
                assert body["status"] == "skipped"          # silent -> free 422 -> skipped
                assert body["call_state"] == "verifying"    # skipped clips never change state
                ids.append(body["clip_id"])
        assert len(set(ids)) == 4, ids


def test_crash_still_returns_cors_header(monkeypatch):
    """An unexpected error must reach the browser as JSON 500 + CORS, not 'Failed to fetch'."""
    def boom(*args, **kwargs):
        raise RuntimeError("simulated crash")
    monkeypatch.setattr(decision, "clip_status", boom)
    with TestClient(main.app, raise_server_exceptions=False) as client:
        r = send_clip(client, new_call(client), 0)
    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") == "*"
    assert r.json()["detail"]["code"] == "internal_error"
