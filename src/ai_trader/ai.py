"""LLM-related helpers: intent classification, chat, and trading analysis."""

from __future__ import annotations

from typing import Literal

from openai import OpenAI

from . import prompts

Intent = Literal["chat", "crypto"]


def normal_chat(client: OpenAI, model: str, query: str) -> str:
    res = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": prompts.CHAT_SYSTEM},
            {"role": "user", "content": query},
        ],
        temperature=0.7,
    )
    return res.choices[0].message.content


def classify_intent(client: OpenAI, model: str, query: str) -> Intent:
    prompt = prompts.CLASSIFIER_PROMPT.format(query=query)
    res = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": prompts.CLASSIFIER_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )
    intent = res.choices[0].message.content.strip().lower()
    return "crypto" if "crypto" in intent else "chat"


def ai_analysis(client: OpenAI, model: str, market_data: str, user_query: str) -> str:
    prompt = prompts.ANALYSIS_PROMPT.format(market_data=market_data, user_query=user_query)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": prompts.TRADER_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content
