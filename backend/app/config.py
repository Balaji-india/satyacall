"""All settings in one place, read from backend/.env (never committed)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


# DetectifAI connection. The key is only ever sent in the Authorization header, never logged.
DETECTIF_API_KEY = os.getenv("DETECTIF_API_KEY", "").strip()
DETECTIF_BASE_URL = os.getenv("DETECTIF_BASE_URL", "https://platform.detectif.ai").rstrip("/")

# v3 credit rules (PLAN.md "v3")
DEV_REPLAY = _bool("DEV_REPLAY", False)                # reuse Idempotency-Key per identical clip while testing
EIDOS_ON_FIRST_CLIP = _bool("EIDOS_ON_FIRST_CLIP", False)
CREDIT_FLOOR = int(os.getenv("CREDIT_FLOOR", "600"))

CLIP_SECONDS = float(os.getenv("CLIP_SECONDS", "10"))
DB_PATH = os.getenv("DB_PATH", str(BACKEND_DIR / "satyacall.db"))
