"""Model selection and LLM client creation."""

from __future__ import annotations

import os

import httpx
from openai import OpenAI

DEFAULT_OPTIONS: dict[str, tuple[str, str]] = {
    "1": ("deepseek", "deepseek-chat"),
    "2": ("openai", "gpt-4o"),
    "3": ("openai", "gpt-4.1-mini"),
}


def choose_model(prompt_fn=input) -> tuple[str, str]:
    print("\nSelect model:")
    print("1. deepseek-chat")
    print("2. gpt-4o")
    print("3. gpt-4.1-mini")
    print("4. custom")

    choice = prompt_fn("Input option number: ").strip()
    if choice in DEFAULT_OPTIONS:
        return DEFAULT_OPTIONS[choice]

    model = prompt_fn("Input model name: ").strip()
    provider = prompt_fn("Input provider (deepseek/openai): ").strip().lower()
    if provider not in {"deepseek", "openai"}:
        raise ValueError("Unsupported provider. Use deepseek or openai.")
    if not model:
        raise ValueError("Model cannot be empty.")
    return provider, model


def init_client(provider: str, api_key: str) -> OpenAI:
    trust_env = os.getenv("AI_TRADER_TRUST_ENV_PROXY", "").strip().lower() in {"1", "true", "yes"}
    http_client = httpx.Client(trust_env=trust_env)
    if provider == "deepseek":
        return OpenAI(api_key=api_key, base_url="https://api.deepseek.com", http_client=http_client)
    if provider == "openai":
        return OpenAI(api_key=api_key, http_client=http_client)
    raise ValueError(f"Unsupported provider: {provider}")
