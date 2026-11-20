"""Multi-provider LLM orchestration client with streaming and safety fallbacks."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security_redaction import redact_secrets

logger = get_logger("llm_client")
settings = get_settings()


class LLMClient:
    """Unified asynchronous enterprise LLM client supporting OpenAI, Gemini, Anthropic, Groq, and Ollama."""

    @classmethod
    def is_configured(cls) -> bool:
        """Check if active LLM credentials or local endpoint are available."""
        provider = (settings.AI_PROVIDER or "").lower().strip()
        if provider == "ollama":
            return True
        if settings.AI_API_KEY and len(settings.AI_API_KEY.strip()) > 3:
            return True
        return False

    @classmethod
    def get_provider_details(cls) -> dict[str, Any]:
        """Return provider connection telemetry for status badges."""
        return {
            "provider": settings.AI_PROVIDER,
            "model": settings.AI_MODEL,
            "is_configured": cls.is_configured(),
            "base_url": settings.AI_BASE_URL or "default",
        }

    @classmethod
    def _resolve_endpoint_and_headers(cls) -> tuple[str, dict[str, str]]:
        """Determine endpoint URL and authentication headers based on AI_PROVIDER."""
        provider = (settings.AI_PROVIDER or "openai").lower().strip()
        api_key = settings.AI_API_KEY or ""
        base_url = (settings.AI_BASE_URL or "").rstrip("/")

        if provider == "gemini":
            url = f"{base_url}/chat/completions" if base_url else "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
        elif provider == "groq":
            url = f"{base_url}/chat/completions" if base_url else "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
        elif provider == "ollama":
            url = f"{base_url}/chat/completions" if base_url else "http://localhost:11434/v1/chat/completions"
            headers = {"Content-Type": "application/json"}
        elif provider == "anthropic":
            url = f"{base_url}/messages" if base_url else "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
        else:  # default openai
            url = f"{base_url}/chat/completions" if base_url else "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

        return url, headers

    @classmethod
    async def generate_response(
        cls,
        messages: list[dict[str, str]],
        system_prompt: str | None = None,
        json_mode: bool = False,
    ) -> dict[str, Any]:
        """Execute non-streaming LLM inference with redacted context."""
        if not cls.is_configured():
            return {
                "content": (
                    "**AI_NOT_CONFIGURED**: An LLM provider API key has not been configured in DevOpsPulse settings.\n\n"
                    "To enable real-time AI Root Cause Analysis and AI Copilot, please set the following in your `.env` or system environment:\n"
                    "```bash\n"
                    "AI_PROVIDER=openai # or gemini, anthropic, groq, ollama\n"
                    "AI_API_KEY=your_api_key_here\n"
                    "AI_MODEL=gpt-4o # or gemini-1.5-pro, claude-3-5-sonnet\n"
                    "```\n"
                    "Alternatively, run a local Ollama instance without API keys (`AI_PROVIDER=ollama`)."
                ),
                "is_error": True,
                "error_code": "AI_NOT_CONFIGURED",
                "model": settings.AI_MODEL,
                "tokens_used": 0,
            }

        # Redact any accidental secrets from the messages before sending
        scrubbed_messages: list[dict[str, str]] = []
        if system_prompt:
            scrubbed_messages.append({"role": "system", "content": redact_secrets(system_prompt)})
        for m in messages:
            scrubbed_messages.append({
                "role": m.get("role", "user"),
                "content": redact_secrets(m.get("content", "")),
            })

        url, headers = cls._resolve_endpoint_and_headers()
        provider = (settings.AI_PROVIDER or "").lower().strip()

        payload: dict[str, Any] = {
            "model": settings.AI_MODEL,
            "messages": scrubbed_messages,
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS,
        }
        if json_mode and provider in ("openai", "groq", "gemini", "ollama"):
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=float(settings.AI_TIMEOUT_SECONDS)) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code != 200:
                    logger.error("LLM provider returned non-200", status=resp.status_code, body=resp.text)
                    return {
                        "content": f"**LLM_PROVIDER_ERROR (HTTP {resp.status_code})**: {resp.text[:300]}",
                        "is_error": True,
                        "error_code": "LLM_PROVIDER_ERROR",
                        "model": settings.AI_MODEL,
                        "tokens_used": 0,
                    }
                data = resp.json()
                choice = data.get("choices", [{}])[0]
                content = choice.get("message", {}).get("content", "")
                tokens = data.get("usage", {}).get("total_tokens", 0)

                return {
                    "content": content,
                    "is_error": False,
                    "error_code": None,
                    "model": settings.AI_MODEL,
                    "tokens_used": tokens,
                }
        except Exception as exc:
            logger.error("Failed connecting to LLM provider", error=str(exc))
            return {
                "content": f"**LLM_CONNECTION_FAILED**: Unable to reach {provider} endpoint: {type(exc).__name__}",
                "is_error": True,
                "error_code": "CONNECTION_FAILED",
                "model": settings.AI_MODEL,
                "tokens_used": 0,
            }

    @classmethod
    async def stream_response(
        cls,
        messages: list[dict[str, str]],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream real-time tokens via SSE from the LLM provider."""
        if not cls.is_configured():
            yield (
                "**AI_NOT_CONFIGURED**: AI Provider credentials are not configured. "
                "Please configure `AI_API_KEY` or set `AI_PROVIDER=ollama` in settings."
            )
            return

        scrubbed_messages: list[dict[str, str]] = []
        if system_prompt:
            scrubbed_messages.append({"role": "system", "content": redact_secrets(system_prompt)})
        for m in messages:
            scrubbed_messages.append({
                "role": m.get("role", "user"),
                "content": redact_secrets(m.get("content", "")),
            })

        url, headers = cls._resolve_endpoint_and_headers()
        payload = {
            "model": settings.AI_MODEL,
            "messages": scrubbed_messages,
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=float(settings.AI_TIMEOUT_SECONDS)) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        yield f"**LLM_PROVIDER_ERROR (HTTP {response.status_code})**"
                        return

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if raw_data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(raw_data)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    yield token
                            except Exception:
                                continue
        except Exception as exc:
            logger.error("LLM streaming connection dropped", error=str(exc))
            yield f"\n\n*[Connection dropped: {type(exc).__name__}]*"
