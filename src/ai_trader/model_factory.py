"""Model selection and client initialization."""

from __future__ import annotations

from typing import Tuple

from openai import OpenAI

DEFAULT_OPTIONS = {
    "1": ("deepseek", "deepseek-chat"),
    "2": ("openai", "gpt-4o"),
}


def choose_model(prompt_fn=input) -> Tuple[str, str]:
    """Interactive model chooser.

    ``prompt_fn`` keeps the function testable.
    """

    print("\n请选择模型：")
    print("1. deepseek-chat")
    print("2. gpt-4o")
    print("3. 自定义")

    choice = prompt_fn("👉 输入编号：").strip()

    if choice in DEFAULT_OPTIONS:
        return DEFAULT_OPTIONS[choice]

    model = prompt_fn("输入模型名称：").strip()
    provider = prompt_fn("输入提供商（deepseek/openai）：").strip().lower()
    return provider, model


def init_client(provider: str, api_key: str) -> OpenAI:
    """Create an OpenAI-compatible client for the given provider."""

    if provider == "deepseek":
        return OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    if provider == "openai":
        return OpenAI(api_key=api_key)

    raise ValueError("不支持的模型提供商")
