"""LLM helpers with graceful fallback."""

from __future__ import annotations

from typing import Literal

from openai import APIConnectionError, APIError, OpenAI, RateLimitError

from . import prompts

Intent = Literal["chat", "crypto"]


class LLMUnavailableError(RuntimeError):
    """Raised when LLM operation cannot be completed."""


def _safe_chat_create(client: OpenAI, **kwargs):
    try:
        return client.chat.completions.create(**kwargs)
    except (APIConnectionError, RateLimitError, APIError) as exc:
        raise LLMUnavailableError(str(exc)) from exc
    except Exception as exc:
        raise LLMUnavailableError(f"Unexpected LLM error: {exc}") from exc


def normal_chat(client: OpenAI, model: str, query: str) -> str:
    res = _safe_chat_create(
        client,
        model=model,
        messages=[
            {"role": "system", "content": prompts.CHAT_SYSTEM},
            {"role": "user", "content": query},
        ],
        temperature=0.7,
    )
    return res.choices[0].message.content or "No response."


def classify_intent(client: OpenAI, model: str, query: str) -> Intent:
    prompt = prompts.CLASSIFIER_PROMPT.format(query=query)
    res = _safe_chat_create(
        client,
        model=model,
        messages=[
            {"role": "system", "content": prompts.CLASSIFIER_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )
    intent = (res.choices[0].message.content or "").strip().lower()
    return "crypto" if "crypto" in intent else "chat"


def ai_analysis(client: OpenAI, model: str, market_data: str, user_query: str) -> str:
    prompt = prompts.ANALYSIS_PROMPT.format(market_data=market_data, user_query=user_query)
    res = _safe_chat_create(
        client,
        model=model,
        messages=[
            {"role": "system", "content": prompts.TRADER_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    return res.choices[0].message.content or "No response."
