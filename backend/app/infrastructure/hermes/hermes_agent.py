"""Infrastructure: Hermes-Agent-Adapter.

Implementiert den ``AgentPort`` gegen den **OpenAI-kompatiblen API-Server** von
Hermes (Nous Research). Hermes übernimmt Agentenlogik, Memory, Tool Calling und
die LLM-Anbindung (OpenRouter) selbst — wir streamen lediglich

    POST {base_url}/v1/chat/completions   (stream=true, SSE)

und übersetzen die Antwort in Domain-Events:

  * ``chat.completion.chunk`` → ``TextDelta``
  * ``hermes.tool.progress``  → ``ToolProgress``  (Hermes-Erweiterung)

Memory über mehrere Turns hinweg verwaltet Hermes serverseitig; für den
Konversationskontext halten wir zusätzlich eine kurze Nachrichtenliste.

Siehe https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.application.ports.agent_port import AgentPort
from app.core.config import Settings
from app.domain.agent_events import AgentEvent, TextDelta, ToolProgress

logger = logging.getLogger(__name__)


class HermesAgent(AgentPort):
    """Adapter, der den Hermes-API-Server hinter dem ``AgentPort`` kapselt."""

    def __init__(self, settings: Settings) -> None:
        self._base_url = settings.hermes_base_url.rstrip("/")
        self._model = settings.hermes_model
        self._timeout = settings.hermes_request_timeout
        self._headers = {
            "Authorization": f"Bearer {settings.hermes_api_key}",
            "Content-Type": "application/json",
        }
        # Kurzer Konversationskontext (Langzeit-Memory hält Hermes selbst).
        self._system_prompt = settings.hermes_system_prompt
        self._messages: list[dict[str, str]] = [
            {"role": "system", "content": self._system_prompt}
        ]

    async def handle(self, transcript: str) -> AsyncIterator[AgentEvent]:
        """Streamt Hermes' Antwort als Domain-Events."""
        self._messages.append({"role": "user", "content": transcript})
        payload = {"model": self._model, "messages": self._messages, "stream": True}

        assistant_text = ""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/v1/chat/completions",
                    headers=self._headers,
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for event in self._iter_sse(response):
                        if isinstance(event, TextDelta):
                            assistant_text += event.text
                        yield event
        except httpx.HTTPError as exc:
            logger.error("Hermes-Anfrage fehlgeschlagen: %s", exc)
            yield TextDelta(text="Entschuldigung, der Agent ist gerade nicht erreichbar.")
            return
        finally:
            if assistant_text:
                self._messages.append({"role": "assistant", "content": assistant_text})

    async def reset(self) -> None:
        """Verwirft den lokalen Konversationskontext."""
        self._messages = [{"role": "system", "content": self._system_prompt}]

    # ── SSE-Parsing ────────────────────────────────────────────────────

    async def _iter_sse(self, response: httpx.Response) -> AsyncIterator[AgentEvent]:
        """Parst den SSE-Strom und mappt Chunks auf Domain-Events."""
        async for line in response.aiter_lines():
            if not line or not line.startswith("data:"):
                continue
            data = line[len("data:") :].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
            except json.JSONDecodeError:
                continue

            obj = chunk.get("object")
            if obj == "hermes.tool.progress":
                # Hermes-spezifisches Event für Tool-Sichtbarkeit.
                yield ToolProgress(
                    tool=chunk.get("tool", "tool"),
                    status=chunk.get("status", "started"),
                    detail=chunk.get("detail", {}) or {},
                )
                continue

            # Standard-OpenAI-Delta.
            for choice in chunk.get("choices", []):
                text = (choice.get("delta") or {}).get("content")
                if text:
                    yield TextDelta(text=text)
