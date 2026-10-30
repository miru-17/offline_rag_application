"""
Personal data (PII) detection and redaction for Indian and common formats.

Detected: Aadhaar (12 digits, Verhoeff checksum), PAN, Indian mobile numbers,
email addresses, IFSC codes, payment card numbers (Luhn checksum).

Modes (per tenant):
    off    - nothing is checked
    flag   - counts are stored on the document so admins can see them
    redact - values are replaced with [REDACTED:TYPE] before the text is
             indexed, so the AI never sees or repeats them

Checksums keep false positives low; detection is rule-based and can still
miss unusual formats, so it supports compliance work but does not replace it.
"""

from __future__ import annotations

import re
from collections import Counter

_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def verhoeff_valid(number: str) -> bool:
    check = 0
    for index, digit in enumerate(reversed(number)):
        check = _VERHOEFF_D[check][_VERHOEFF_P[index % 8][int(digit)]]
    return check == 0


def luhn_valid(number: str) -> bool:
    total = 0
    for index, digit in enumerate(reversed(number)):
        value = int(digit)
        if index % 2 == 1:
            value *= 2
            if value > 9:
                value -= 9
        total += value
    return total % 10 == 0


def _digits(value: str) -> str:
    return re.sub(r"\D", "", value)


# (type, pattern, validator)
_RULES = [
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), None),
    ("PAN", re.compile(r"\b[A-Z]{3}[ABCFGHLJPTK][A-Z]\d{4}[A-Z]\b"), None),
    ("IFSC", re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b"), None),
    ("CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b"),
     lambda m: 13 <= len(_digits(m)) <= 19 and luhn_valid(_digits(m))),
    ("AADHAAR", re.compile(r"\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b"),
     lambda m: len(_digits(m)) == 12 and verhoeff_valid(_digits(m))),
    ("PHONE", re.compile(r"(?<!\d)(?:\+91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?!\d)"), None),
]


def scan(text: str) -> Counter:
    counts: Counter = Counter()
    _, found = _apply(text, redact=False)
    counts.update(found)
    return counts


def redact(text: str) -> tuple[str, Counter]:
    return _apply(text, redact=True)


def _apply(text: str, redact: bool) -> tuple[str, Counter]:
    counts: Counter = Counter()
    if not text:
        return text, counts

    for pii_type, pattern, validator in _RULES:
        def replace(match: re.Match) -> str:
            value = match.group(0)
            if validator is not None and not validator(value):
                return value
            counts[pii_type] += 1
            return f"[REDACTED:{pii_type}]" if redact else value

        text = pattern.sub(replace, text)

    return text, counts
