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


# ---------- A5: actions and the Say-It-Back sentence (PLAN §3) ----------

HIGH_RISK = {"add_payee", "change_mobile", "change_email", "change_address", "reset_credentials",
             "raise_limit", "large_transfer", "card_new_address", "unblock"}
LOW_RISK = {"balance", "card_status", "statement", "complaint_status", "branch_info"}


def action_decision(action_type: str, call_state: str, can_say_it_back: bool):
    """High-risk -> always Say-It-Back. Low-risk -> allowed, unless the call is in ALERT.
    If Say-It-Back cannot run (customer not enrolled, credit floor, or already failed twice
    on this call) -> fallback to the bank's existing OTP / call-back. Returns (risk, decision)."""
    risk = "high" if action_type in HIGH_RISK else "low"
    if risk == "low" and call_state != "alert":
        return risk, "allow"
    return risk, ("say_it_back" if can_say_it_back else "fallback")


_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
         "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
_DIGITS = ["zero"] + _ONES[1:10]


def _below_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return _TENS[n // 10] + ("-" + _ONES[n % 10] if n % 10 else "")


def _below_thousand(n: int) -> str:
    hundreds, rest = divmod(n, 100)
    parts = [_ONES[hundreds] + " hundred"] if hundreds else []
    if rest:
        parts.append(_below_hundred(rest))
    return " ".join(parts)


def amount_in_words(n: int) -> str:
    """Indian numbering, as people say it: 25000 -> 'twenty-five thousand',
    150000 -> 'one lakh fifty thousand', 20000000 -> 'two crore'."""
    if n == 0:
        return "zero"
    parts = []
    for size, name in ((10_000_000, "crore"), (100_000, "lakh"), (1_000, "thousand")):
        count, n = divmod(n, size)
        if count:
            # crore can exceed 99 (e.g. 150 crore), so use the hundreds speller for it
            parts.append(f"{_below_thousand(count)} {name}")
    if n:
        parts.append(_below_thousand(n))
    return " ".join(parts)


def digits_in_words(digits: str) -> str:
    """'4321' -> 'four three two one' (how people read out numbers)."""
    return " ".join(_DIGITS[int(d)] for d in digits if d.isdigit())


def _amount(params: dict):
    raw = str(params.get("amount") or "").replace(",", "").strip()
    if not raw:
        return None
    if not raw.isdigit() or int(raw) <= 0:
        raise ValueError("amount must be a positive whole number of rupees")
    return f"{amount_in_words(int(raw))} rupees"


def _clean(text, field: str, max_len: int = 60) -> str:
    """Names/places go into a spoken sentence: letters, spaces, . ' - only."""
    text = " ".join(str(text or "").split())
    if not text:
        return ""
    if len(text) > max_len or not all(ch.isalpha() or ch in " .'-" for ch in text):
        raise ValueError(f"{field} must be letters only (max {max_len} characters)")
    return text


def say_it_back_phrase(action_type: str, params: dict) -> str:
    """The 'want to ...' part of the sentence for each action. Raises ValueError on bad params."""
    amount = _amount(params)
    payee = _clean(params.get("payee_name"), "payee_name")
    if action_type == "add_payee":
        if not payee:
            raise ValueError("payee_name is required for add_payee")
        return f"add {payee} as a payee" + (f" for {amount}" if amount else "")
    if action_type == "large_transfer":
        if not amount:
            raise ValueError("amount is required for large_transfer")
        return f"transfer {amount}" + (f" to {payee}" if payee else "")
    if action_type == "change_mobile":
        last4 = "".join(ch for ch in str(params.get("new_mobile") or "") if ch.isdigit())[-4:]
        return "change my registered mobile number" + (
            f" to the new number ending in {digits_in_words(last4)}" if len(last4) == 4 else "")
    if action_type == "change_address":
        city = _clean(params.get("city"), "city")
        return "change my registered address" + (f" to my new address in {city}" if city else "")
    if action_type == "raise_limit":
        return "raise my daily transaction limit" + (f" to {amount}" if amount else "")
    fixed = {
        "change_email": "change my registered email address",
        "reset_credentials": "reset my login password and PIN",
        "card_new_address": "send my new card to a new address",
        "unblock": "unblock my card and UPI",
        "balance": "check my account balance",
        "card_status": "check my card status",
        "statement": "get my account statement",
        "complaint_status": "check my complaint status",
        "branch_info": "get my branch information",
    }
    return fixed[action_type]


def say_it_back_sentence(customer_name: str, action_type: str, params: dict) -> str:
    """About 10 s when spoken (PLAN §2 L3). Only the words the customer must say;
    the UI shows it after 'To confirm, please say:'."""
    return f"I, {customer_name}, want to {say_it_back_phrase(action_type, params)} today."
