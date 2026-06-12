"""Application-Port: Schnittstelle zum Agenten.

Ein *Port* (im Sinne der Ports-&-Adapters-/Hexagonal-Architektur) ist ein
abstrakter Vertrag, den die Anwendungsschicht definiert und den die
Infrastruktur (hier: ``HermesAgent``) erfüllt. Dadurch hängt die Kernlogik
nicht von Hermes, OpenRouter o. Ä. ab — diese sind austauschbare Details.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class AgentPort(ABC):
    """Vertrag, den jeder Agent (z. B. Hermes) erfüllen muss.

    Die Anwendungsschicht ruft ausschließlich gegen dieses Interface auf.
    """

    @abstractmethod
    async def handle(self, transcript: str) -> AsyncIterator[str]:
        """Verarbeitet einen Nutzer-Input und streamt die Antwort als Text-Deltas.

        Args:
            transcript: Der final erkannte Nutzertext.

        Yields:
            Antwort-Fragmente (Tokens/Chunks), während sie generiert werden.

        Hinweis: Tool-Aufrufe und Memory verwaltet der Agent intern; relevante
        Statusereignisse meldet er über einen separaten Event-Kanal (siehe
        ``SessionService``).
        """
        raise NotImplementedError

    @abstractmethod
    async def reset(self) -> None:
        """Setzt den Gesprächskontext der aktuellen Session zurück."""
        raise NotImplementedError
