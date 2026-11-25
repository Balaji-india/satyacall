"""A6 Say-It-Back tests. 0 credits:
- the 'wrong words' path never calls DetectifAI (we skip Eidos when the words don't match);
- the 'pass' path replays DetectifAI's REAL recorded verify response (docs/api-samples/verify.json)
  instead of a live call, so the mapping is tested against real fields without spending ~520 credits.
Needs the Whisper model in backend/models (download_model.cmd); those tests skip if it is missing.
Run from backend/:  .venv/Scripts/python -m pytest -q
"""
import json
import os
import pathlib
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test_sib.db")
os.environ["STT_PRELOAD"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db, detectif, main, stt  # noqa: E402

HERE = pathlib.Path(__file__).parent
REAL_VERIFY = json.loads((HERE.parent.parent / "docs" / "api-samples" / "verify.json").read_text())
PAYEE = {"action_type": "add_payee", "params": {"payee_name": "Ramesh Kumar", "amount": "25000"}}
needs_model = pytest.mark.skipif(not (stt.MODEL_DIR / "model.bin").is_file(), reason="Whisper model not downloaded")


def wav(name):
    return {"file": (name, (HERE / "fixtures" / name).read_bytes(), "audio/wav")}


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        db.conn.execute("INSERT OR IGNORE INTO people (person_id, speaker_id, display_name, role, samples) "
                        "VALUES ('balaji', 'cust-balaji', 'Balaji Keerthi', 'customer', 1)")
        db.conn.commit()
        yield c


def call_with_payee(client, state=None):
    call_id = client.post("/api/calls", json={"direction": "inbound", "claimed_customer_id": "balaji",
                                              "agent_id": "4521"}).json()["call_id"]
    if state:
        db.conn.execute("UPDATE calls SET state = ? WHERE call_id = ?", (state, call_id))
        db.conn.commit()
    r = client.post(f"/api/calls/{call_id}/action", json=PAYEE)
    assert r.json()["decision"] == "say_it_back"
    return call_id


# ---- text matching (PLAN §3 + our two guards) ----

EXP = "I, Balaji Keerthi, want to add Ramesh Kumar as a payee for twenty-five thousand rupees today."


@pytest.mark.parametrize("said, ok", [
    (" I, Balaji Keerthi, want to add Ramesh Kumar as a payee for 25,000 rupees today.", True),
    ("I Balaji Keerti want to add Ramesh Kumar as a payee for Rs. 25000 today", True),
    ("I want to today", False),                    # subset: token_set_ratio alone would give 1.00
    ("I, Balaji Keerthi, want to add Ramesh Kumar as a payee for fifty thousand rupees today.", False),
    ("I want to change my mobile number right now please", False),
])
def test_text_rules(said, ok):
    score, coverage = stt.text_match(EXP, said)
    assert stt.text_passes(score, coverage, stt.numbers_match(EXP, said)) is ok


def test_mobile_digits_either_form():
    exp = "I, Balaji Keerthi, want to change my registered mobile number to the new number ending in four three two one today."
    said = "I Balaji Keerthi want to change my registered mobile number to the new number ending in 4321 today"
    assert stt.text_passes(*stt.text_match(exp, said), stt.numbers_match(exp, said))


# ---- endpoint ----

def test_needs_action_first(client):
    call_id = client.post("/api/calls", json={"direction": "inbound", "claimed_customer_id": "balaji"}).json()["call_id"]
    r = client.post(f"/api/calls/{call_id}/say-it-back", files=wav("tts_wrong.wav"), data={"attempt": 1})
    assert r.status_code == 409


def test_webm_rejected_with_clear_message(client):
    call_id = call_with_payee(client)
    r = client.post(f"/api/calls/{call_id}/say-it-back",
                    files={"file": ("x.webm", b"\x1aE\xdf\xa3 not wav", "audio/webm")}, data={"attempt": 1})
    assert r.status_code == 415 and "WAV" in r.json()["detail"]


@needs_model
def test_wrong_words_retry_then_fallback_without_credits(client, monkeypatch):
    async def must_not_run(*a, **k):
        raise AssertionError("Eidos must not run when the words don't match")
    monkeypatch.setattr(detectif, "verify_with_deepfake", must_not_run)
    call_id = call_with_payee(client)
    r1 = client.post(f"/api/calls/{call_id}/say-it-back", files=wav("tts_wrong.wav"), data={"attempt": 1}).json()
    assert r1["pass"] is False and r1["next_step"] == "retry"
    assert r1["speaker"]["decision"] == "not_checked"
    r2 = client.post(f"/api/calls/{call_id}/say-it-back", files=wav("tts_wrong.wav"), data={"attempt": 2}).json()
    assert r2["next_step"] == "fallback"
    # both attempts used -> further attempts refused, and new high-risk actions go to fallback
    assert client.post(f"/api/calls/{call_id}/say-it-back", files=wav("tts_wrong.wav"), data={"attempt": 2}).status_code == 409
    assert client.post(f"/api/calls/{call_id}/action", json=PAYEE).json()["decision"] == "fallback"


@needs_model
def test_pass_with_real_recorded_response_leaves_alert(client, monkeypatch):
    async def replay(method, path, **kwargs):       # DetectifAI's real response from this morning
        assert path == "/v1/speakers/verify" and kwargs["data"]["detect_deepfake"] == "true"
        return 200, REAL_VERIFY, 516
    monkeypatch.setattr(detectif, "_send", replay)
    call_id = call_with_payee(client, state="alert")
    r = client.post(f"/api/calls/{call_id}/say-it-back", files=wav("tts_payee.wav"), data={"attempt": 1}).json()
    assert r["text_match"] >= 0.85, r["transcript"]
    assert r["speaker"]["decision"] == "match" and r["speaker"]["similarity"] == REAL_VERIFY["result"]["similarity"]
    assert r["speaker"]["threshold"] == 0.53
    assert r["authenticity"]["verdict"] == "real" and r["authenticity"]["threshold"] == 0.62
    assert r["authenticity"]["operation_id"] == REAL_VERIFY["deepfake"]["operation_id"]
    assert r["pass"] is True and r["next_step"] == "approved"
    state = client.get  # noqa
    row = db.conn.execute("SELECT state, identity FROM calls WHERE call_id = ?", (call_id,)).fetchone()
    assert (row["state"], row["identity"]) == ("verified", "match")
