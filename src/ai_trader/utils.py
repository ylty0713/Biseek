"""Utility helpers."""

from __future__ import annotations


def clean_output(text: str) -> str:
    """Remove duplicate lines while preserving order."""
    lines = text.split("\n")
    seen = set()
    result = []
    for line in lines:
        if line not in seen:
            result.append(line)
            seen.add(line)
    return "\n".join(result)
