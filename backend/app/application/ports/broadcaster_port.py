"""Application-Port: Ausgangskanal zu verbundenen Clients.

Abstrahiert das *Wie* der Übertragung (WebSocket, später evtl. SSE/MQTT) weg
von der Anwendungslogik. Der konkrete Adapter ist der ``ConnectionManager`` im
API-Layer.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.messages import Envelope


class BroadcasterPort(ABC):
    """Vertrag zum Senden von Domain-Nachrichten an alle Clients."""

    @abstractmethod
    async def broadcast(self, envelope: Envelope) -> None:
        """Sendet eine Nachricht an alle aktuell verbundenen Clients."""
        raise NotImplementedError
