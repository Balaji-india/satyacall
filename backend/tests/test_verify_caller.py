"""A7 Verify This Caller tests. 0 credits:
- 'no call log' paths never call DetectifAI (v3 rule 2c);
- the 'verified' path replays DetectifAI's REAL recorded verify response (docs/api-samples/verify.json).
Run from backend/:  .venv/Scripts/python -m pytest -q
"""
import json
import os
import pathlib
import tempfile

os.environ.setdefault("DB_PATH", os.path.join(tempfile.mkdtemp(), "test_vc.db"))
os.environ["STT_PRELOAD"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db, detectif, main  # noqa: E402

HERE = pathlib.Path(__file__).parent
REAL_VERIFY = json.loads((HERE.parent.parent / "docs" / "api-samples" / "verify.json").read_text())
AUDIO = {"file": ("caller.wav", (HERE / "fixtures" / "tts_wrong.wav").read_bytes(), "audio/wav")}


@pytest.fixture
def client(monkeypatch):
    with TestClient(main.app) as c:
        db.conn.execute("DELETE FROM call_log")
        db.conn.execute("INSERT OR IGNORE INTO people (person_id, speaker_id, display_name, role, samples) "
                        "VALUES ('balaji', 'cust-balaji', 'Balaji Keerthi', 'customer', 1)")
        db.conn.execute("INSERT OR IGNORE INTO people (person_id, speaker_id, display_name, role, employee_id, "
                        "department, samples) VALUES ('agent-4521', 'emp-4521', 'Aravindh', 'agent', '4521', "
                        "'Card Services', 1)")
        db.conn.commit()
        yield c


def forbid_detectif(monkeypatch):
    async def must_not_run(*a, **k):
        raise AssertionError("no call log -> DetectifAI must not be called")
    monkeypatch.setattr(detectif, "verify_with_deepfake", must_not_run)


def outbound(client, agent="4521", customer="balaji"):
    return client.post("/api/calls", json={"direction": "outbound", "claimed_customer_id": customer,
                                           "agent_id": agent}).json()["call_id"]


def test_scene_6b_no_call_log_not_verified_and_free(client, monkeypatch):
    forbid_detectif(monkeypatch)
    r = client.post("/api/verify-caller", files=AUDIO, data={"employee_id": "4521", "customer_id": "balaji"}).json()
    assert r["verified"] is False
    assert r["checks"]["call_log"]["pass"] is False
    assert r["checks"]["speaker"]["decision"] == "not_checked"
    assert r["employee"] == {"name": "Aravindh", "department": "Card Services"}
    assert "official number" in r["next_step"]


def test_ended_or_inbound_call_does_not_count(client, monkeypatch):
    forbid_detectif(monkeypatch)
    client.post(f"/api/calls/{outbound(client)}/end")                     # ended
    client.post("/api/calls", json={"direction": "inbound", "claimed_customer_id": "balaji", "agent_id": "4521"})
    r = client.post("/api/verify-caller", files=AUDIO, data={"employee_id": "4521", "customer_id": "balaji"}).json()
    assert r["checks"]["call_log"]["pass"] is False


def test_other_employee_or_customer_does_not_count(client, monkeypatch):
    forbid_detectif(monkeypatch)
    outbound(client, agent="9999")
    outbound(client, customer="someone-else")
    r = client.post("/api/verify-caller", files=AUDIO, data={"employee_id": "4521", "customer_id": "balaji"}).json()
    assert r["checks"]["call_log"]["pass"] is False


def test_scene_6a_verified_with_real_recorded_response(client, monkeypatch):
    async def replay(method, path, **kwargs):
        assert path == "/v1/speakers/verify" and kwargs["data"]["speaker_id"] == "emp-4521"
        return 200, REAL_VERIFY, 516
    monkeypatch.setattr(detectif, "_send", replay)
    call_id = outbound(client, agent="emp-4521", customer="cust-balaji")   # ids typed either way still match
    r = client.post("/api/verify-caller", files=AUDIO, data={"employee_id": "4521", "customer_id": "balaji"}).json()
    assert r["checks"]["call_log"]["pass"] is True and call_id in r["checks"]["call_log"]["detail"]
    assert r["checks"]["speaker"]["decision"] == "match" and r["checks"]["authenticity"]["verdict"] == "real"
    assert r["verified"] is True and r["next_step"].startswith("Verified: Aravindh, Card Services")
