"""Application-Port: Schnittstelle zum Agenten.

Ein *Port* (Ports-&-Adapters-/Hexagonal-Architektur) ist ein abstrakter
Vertrag, den die Anwendungsschicht definiert und den die Infrastruktur (hier:
``HermesAgent``) erfüllt. Dadurch hängt die Kernlogik nicht von Hermes,
OpenRouter o. Ä. ab — diese sind austauschbare Details.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from app.domain.agent_events import AgentEvent


class AgentPort(ABC):
    """Vertrag, den jeder Agent (z. B. Hermes) erfüllen muss."""

    @abstractmethod
    def handle(self, transcript: str) -> AsyncIterator[AgentEvent]:
        """Verarbeitet einen Nutzer-Input und streamt Agent-Events.

        Args:
            transcript: Der final erkannte Nutzertext.

        Yields:
            ``TextDelta`` (Antwortfragmente) und ``ToolProgress`` (Tool-Status),
            während die Antwort generiert wird.

        Hinweis: Als ``async def`` mit ``yield`` zu implementieren (Async-Generator).
        """
        raise NotImplementedError

    @abstractmethod
    async def reset(self) -> None:
        """Setzt den Gesprächskontext der aktuellen Session zurück."""
        raise NotImplementedError
