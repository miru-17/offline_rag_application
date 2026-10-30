"""Protect exported CSV files from spreadsheet formula injection."""

import json

_DANGEROUS_START = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        value = json.dumps(value, default=str)
    text = str(value)
    # Numbers like -42 are safe and stay numbers.
    if text.startswith(_DANGEROUS_START):
        try:
            float(text)
            return text
        except ValueError:
            return "'" + text
    return text
