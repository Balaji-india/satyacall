"""ID normalisation + credits tracking. 0 credits: DetectifAI's REAL recorded responses
(docs/api-samples/*.json) are replayed at the HTTP layer, so our own _send/record_balance code runs.
Run from backend/:  .venv/Scripts/python -m pytest -q
"""
import json
import os
import pathlib
import tempfile

os.environ.setdefault("DB_PATH", os.path.join(tempfile.mkdtemp(), "test_ids.db"))
os.environ["STT_PRELOAD"] = "false"

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db, detectif, main  # noqa: E402

SAMPLES = pathlib.Path(__file__).parent.parent.parent / "docs" / "api-samples"
ENROLL = json.loads((SAMPLES / "enroll.json").read_text())
AUDIO = {"file": ("s.wav", (pathlib.Path(__file__).parent / "fixtures" / "tts_wrong.wav").read_bytes(), "audio/wav")}


@pytest.mark.parametrize("typed, number, speaker", [
    ("4521", "4521", "emp-4521"), ("emp-4521", "4521", "emp-4521"), (" EMP-4521 ", "4521", "emp-4521")])
def test_agent_ids(typed, number, speaker):
    assert main.employee_number(typed) == number
    assert main.agent_speaker_id(typed) == speaker


@pytest.mark.parametrize("typed", ["balaji", "cust-balaji", "Balaji", " cust-balaji "])
def test_customer_ids(typed):
    assert main.canonical_customer(typed) == "cust-balaji"


@pytest.fixture
def client(monkeypatch):
    sent = []

    async def fake_request(self, method, path, **kwargs):      # replay DetectifAI's real enroll response
        sent.append((path, kwargs.get("data")))
        body = dict(ENROLL, speaker=dict(ENROLL["speaker"], speaker_id=kwargs["data"]["speaker_id"]))
        return httpx.Response(200, json=body)
    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    with TestClient(main.app) as c:
        db.conn.execute("DELETE FROM people")
        db.conn.execute("DELETE FROM meta")
        db.conn.commit()
        c.sent = sent
        yield c


def test_enroll_agent_typed_with_prefix(client):
    r = client.post("/api/people/enroll", files=AUDIO, data={"person_id": "agent-4521", "display_name": "Aravindh",
                    "role": "agent", "employee_id": "emp-4521", "department": "Card Services"}).json()
    assert r["speaker_id"] == "emp-4521"                       # not emp-emp-4521
    assert client.sent[-1][1]["speaker_id"] == "emp-4521"
    person = client.get("/api/people").json()[0]
    assert person["employee_id"] == "4521"


def test_enroll_customer_typed_with_prefix_and_updates_credits(client):
    r = client.post("/api/people/enroll", files=AUDIO, data={"person_id": "cust-balaji", "display_name": "Balaji Keerthi",
                    "role": "customer", "phone": "1"}).json()
    assert r["speaker_id"] == "cust-balaji"                    # not cust-cust-balaji
    assert detectif.last_balance() == ENROLL["credits"]["balance"]          # 4780 from the real response


@pytest.mark.parametrize("claimed", ["balaji", "cust-balaji"])
def test_action_finds_customer_either_way(client, claimed):
    db.conn.execute("INSERT OR IGNORE INTO people (person_id, speaker_id, display_name, role, samples) "
                    "VALUES ('balaji', 'cust-balaji', 'Balaji Keerthi', 'customer', 1)")
    db.conn.commit()
    call_id = client.post("/api/calls", json={"direction": "inbound", "claimed_customer_id": claimed}).json()["call_id"]
    r = client.post(f"/api/calls/{call_id}/action", json={"action_type": "unblock", "params": {}}).json()
    assert r["decision"] == "say_it_back" and r["sentence"].startswith("I, Balaji Keerthi,")
