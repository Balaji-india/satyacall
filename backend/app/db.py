"""SQLite storage. One file (satyacall.db), plain SQL, JSON stored as text."""
import sqlite3
from datetime import datetime, timezone

from . import config

# One shared connection is fine for a single-laptop hackathon server.
conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
conn.row_factory = sqlite3.Row  # rows behave like dicts

SCHEMA = """
CREATE TABLE IF NOT EXISTS people (
    person_id      TEXT PRIMARY KEY,
    speaker_id     TEXT NOT NULL,          -- cust-<slug> or emp-<employee_id>
    display_name   TEXT NOT NULL,
    role           TEXT NOT NULL,          -- customer | agent
    phone          TEXT,
    employee_id    TEXT,
    department     TEXT,
    samples        INTEGER DEFAULT 0,
    speech_seconds REAL,
    created_at     TEXT
);
CREATE TABLE IF NOT EXISTS calls (
    call_id             TEXT PRIMARY KEY,
    direction           TEXT NOT NULL,     -- inbound | outbound
    claimed_customer_id TEXT,
    agent_id            TEXT,
    started_at          TEXT,
    ended_at            TEXT,
    state               TEXT DEFAULT 'verifying',
    identity            TEXT DEFAULT 'not_checked'
);
CREATE TABLE IF NOT EXISTS call_log (      -- the bank's own record of outbound calls
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id     TEXT,
    employee_id TEXT,
    customer_id TEXT,
    started_at  TEXT,
    ended_at    TEXT
);
CREATE TABLE IF NOT EXISTS clips (
    clip_id     TEXT PRIMARY KEY,
    call_id     TEXT,
    t_start     REAL,
    t_end       REAL,
    status      TEXT,
    result_json TEXT,                      -- full ClipResult as sent to the frontend
    created_at  TEXT
);
CREATE TABLE IF NOT EXISTS actions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id     TEXT,
    action_type TEXT,
    params_json TEXT,
    risk        TEXT,
    decision    TEXT,
    sentence    TEXT,
    created_at  TEXT
);
CREATE TABLE IF NOT EXISTS say_it_back (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id     TEXT,
    attempt     INTEGER,
    pass        INTEGER,
    transcript  TEXT,
    expected    TEXT,
    text_match  REAL,
    result_json TEXT,
    created_at  TEXT
);
CREATE TABLE IF NOT EXISTS evidence (      -- one row per DetectifAI check (PLAN §3 evidence log)
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id     TEXT,
    kind        TEXT,                      -- clip | say_it_back | verify_caller | enroll
    clip_sha256 TEXT,
    data_json   TEXT,                      -- operation_ids, verdicts, scores, raw, decision, latency, credits
    created_at  TEXT
);
CREATE TABLE IF NOT EXISTS meta (          -- small key/value store, e.g. last known credits balance
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


def init() -> None:
    conn.executescript(SCHEMA)
    conn.commit()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_meta(key: str):
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_meta(key: str, value) -> None:
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
