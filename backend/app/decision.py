"""PLAN.md §3 decision rules. Pure functions, no I/O, so they are easy to explain and test.
We decide ONLY with DetectifAI's verdict/decision. Scores are never compared to our own thresholds."""


def clip_status(check: dict, skipped: bool) -> str:
    """v3: clip colour = voice authenticity only (identity is a separate badge)."""
    if skipped:
        return "skipped"                       # 422, too little speech: free, not scored
    a = check["authenticity"]
    if a["verdict"] == "fake":
        return "red"
    if a["verdict"] == "real":
        if any(seg.get("verdict") == "fake" for seg in a.get("segments") or []):
            return "amber"                     # overall real, but part of the clip looked fake
        return "green"
    return "amber"                             # check unavailable (error)


def identity_from(check: dict, current: str) -> str:
    """Call-level identity badge: only changes when Eidos actually returned match / no_match."""
    decision = check["speaker"]["decision"]
    return decision if decision in ("match", "no_match") else current


def next_call_state(current: str, status: str, previous_status: str | None, was_verified: bool):
    """Rolling call state. Returns (new_state, reason). `previous_status` = last scored clip."""
    if status == "skipped":
        return current, None
    if current == "alert":
        return "alert", None                   # only a passed Say-It-Back leaves ALERT (A6)
    if status == "red":
        if was_verified:
            return "alert", "Possible handover / voice change: AI-voice clip after the caller was verified"
        if previous_status == "red":
            return "alert", "Two AI-voice clips in a row"
        return "watch", "One clip flagged as AI voice; checking the next clip"
    if status == "amber":
        return "watch", "Latest clip mixed or check unavailable"
    return "verified", "Latest clip passed the voice authenticity check"
