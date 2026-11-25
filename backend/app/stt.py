"""Speech-to-text for Say-It-Back: faster-whisper 'base' (English) + text match (PLAN §3).

Why WAV only: this laptop's Application Control policy blocks the ffmpeg DLLs inside PyAV (`av`),
which faster-whisper uses to decode webm/m4a. So the frontend sends Say-It-Back as WAV, we decode it
with Python's built-in `wave` module, and hand faster-whisper the raw samples (it never calls `av`).
"""
import io
import re
import sys
import threading
import types
import wave

import numpy as np
from rapidfuzz import fuzz

from . import config, decision

# faster-whisper does `import av` at import time but only USES it in decode_audio(), which is
# skipped when we pass a numpy array. An empty stand-in module lets the import succeed.
if "av" not in sys.modules:
    try:
        import av  # noqa: F401  (works on machines without the policy)
    except ImportError:
        sys.modules["av"] = types.ModuleType("av")

from faster_whisper import WhisperModel  # noqa: E402

SAMPLE_RATE = 16000          # what Whisper expects
# Local copy of the 'base' model (downloaded once with curl, see backend/download_model.cmd).
# We never let the server download it by itself: the venue hotspot is too slow for that.
MODEL_DIR = config.BACKEND_DIR / "models" / "faster-whisper-base"
MODEL_FILES = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")
TEXT_MATCH_MIN = 0.85        # PLAN §3: token_set_ratio / 100 >= 0.85

_model = None
_model_lock = threading.Lock()


def load_model() -> None:
    """Load once from MODEL_DIR. Thread-safe. Raises FileNotFoundError if not downloaded yet."""
    global _model
    with _model_lock:
        if _model is None:
            missing = [f for f in MODEL_FILES if not (MODEL_DIR / f).is_file()]
            if missing:
                raise FileNotFoundError(f"Whisper model missing {missing}: run backend/download_model.cmd")
            _model = WhisperModel(str(MODEL_DIR), device="cpu", compute_type="int8")


def model_ready() -> bool:
    return _model is not None


class NotWav(ValueError):
    pass


def wav_to_samples(data: bytes) -> np.ndarray:
    """WAV bytes -> mono float32 at 16 kHz (downmix + simple linear resample if needed)."""
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            channels, width, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
            frames = w.readframes(w.getnframes())
    except (wave.Error, EOFError) as e:
        raise NotWav(f"Say-It-Back audio must be a PCM WAV file ({e})")
    if width == 1:
        audio = (np.frombuffer(frames, np.uint8).astype(np.float32) - 128) / 128
    elif width == 2:
        audio = np.frombuffer(frames, np.int16).astype(np.float32) / 32768
    elif width == 4:
        audio = np.frombuffer(frames, np.int32).astype(np.float32) / 2147483648
    else:
        raise NotWav(f"unsupported WAV sample width: {width * 8} bit")
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    if rate != SAMPLE_RATE and len(audio):
        n_out = int(len(audio) * SAMPLE_RATE / rate)
        audio = np.interp(np.linspace(0, len(audio) - 1, n_out), np.arange(len(audio)), audio).astype(np.float32)
    return audio


def transcribe(samples: np.ndarray) -> str:
    load_model()
    segments, _ = _model.transcribe(samples, language="en", beam_size=1, vad_filter=False)
    return " ".join(seg.text.strip() for seg in segments).strip()


def normalise(text: str, expected_norm: str = "") -> str:
    """lowercase, no punctuation, numbers as words. A number in the transcript is spoken either as an
    amount ('25000' -> 'twenty five thousand') or digit by digit ('4321' -> 'four three two one');
    we pick whichever form appears in the expected sentence, so both are accepted."""
    text = text.lower().replace("₹", " rupees ")
    text = re.sub(r"(?<=\d),(?=\d)", "", text)          # 25,000 -> 25000
    text = re.sub(r"\brs\b\.?", " rupees ", text)

    def number_to_words(m):
        digits = m.group(0)
        as_amount = decision.amount_in_words(int(digits)).replace("-", " ")
        as_digits = decision.digits_in_words(digits)
        return as_digits if as_digits in expected_norm and as_amount not in expected_norm else as_amount

    text = re.sub(r"\d+", number_to_words, text)
    text = re.sub(r"[^a-z\s]", " ", text.replace("-", " "))
    return " ".join(text.split())


def text_match(expected: str, transcript: str):
    """Returns (text_match, coverage).
    text_match = rapidfuzz token_set_ratio / 100, exactly as PLAN §3.
    coverage = share of the expected words that were actually said (fuzzy, so 'Keerti' counts for
    'Keerthi'). Needed because token_set_ratio alone gives 100 when the speaker says only a SUBSET
    of the sentence (e.g. just 'I want to ... today')."""
    exp = normalise(expected)
    got = normalise(transcript, exp)
    score = fuzz.token_set_ratio(exp, got) / 100
    exp_words, got_words = exp.split(), got.split()
    if not exp_words:
        return score, 0.0
    said = sum(1 for w in exp_words if any(fuzz.ratio(w, g) >= 80 for g in got_words))
    return round(score, 3), round(said / len(exp_words), 3)


NUMBER_WORDS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
                "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
                "hundred", "thousand", "lakh", "lakhs", "crore", "crores"}


def numbers_match(expected: str, transcript: str) -> bool:
    """The amount / mobile digits are the part that matters most: the number words must be EXACTLY
    the same, in order. Otherwise 'fifty thousand' instead of 'twenty-five thousand' would pass the
    fuzzy checks (only one word differs)."""
    exp = normalise(expected)
    got = normalise(transcript, exp)
    def nums(s):
        return [w.rstrip("s") if w in ("lakhs", "crores") else w for w in s.split() if w in NUMBER_WORDS]
    return nums(exp) == nums(got)


def text_passes(score: float, coverage: float, numbers_ok: bool) -> bool:
    return score >= TEXT_MATCH_MIN and coverage >= TEXT_MATCH_MIN and numbers_ok
