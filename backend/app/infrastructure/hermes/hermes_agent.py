"""Infrastructure: Hermes-Agent-Adapter.

Implementiert den ``AgentPort``. Hier wird im Vollausbau der Hermes Agent
verdrahtet (Agentenlogik, Memory, Tool Calling, OpenRouter) — über den
``OpenRouterClient`` und das ``TelegramGateway``.

> Grundgerüst: Liefert eine statische Platzhalter-Antwort, damit der
> End-to-End-Nachrichtenfluss demonstrierbar ist, ohne externe APIs zu rufen.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from app.application.ports.agent_port import AgentPort
from app.infrastructure.openrouter.openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)


class HermesAgent(AgentPort):
    """Adapter, der den Hermes Agent hinter dem ``AgentPort`` kapselt."""

    def __init__(self, llm: OpenRouterClient) -> None:
        self._llm = llm
        # TODO(Businesslogik): Memory-Store, Tool-Registry, Hermes-Runtime.

    async def handle(self, transcript: str) -> AsyncIterator[str]:
        """Streamt eine Platzhalter-Antwort.

        TODO(Businesslogik): An Hermes/OpenRouter delegieren, Tool-Calls und
        Memory verarbeiten.
        """
        logger.info("HermesAgent.handle(stub): %r", transcript)
        for chunk in ("Hallo. ", "Ich bin Friday. ", "Noch ohne Businesslogik."):
            yield chunk

    async def reset(self) -> None:
        """Setzt den Gesprächskontext zurück (Stub)."""
        logger.info("HermesAgent.reset(stub)")
