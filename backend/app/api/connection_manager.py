"""API: WebSocket-Verbindungsverwaltung.

Konkreter Adapter für den ``BroadcasterPort``. Hält die Menge aktiver
WebSocket-Verbindungen und sendet Domain-Nachrichten an alle Clients.
Da Friday typischerweise genau einen Kiosk-Client bedient, ist die Implementierung
bewusst schlank — aber mehrclientfähig (z. B. zusätzliche Debug-Ansicht).
"""

from __future__ import annotations

import logging

from fastapi import WebSocket

from app.application.ports.broadcaster_port import BroadcasterPort
from app.domain.messages import Envelope

logger = logging.getLogger(__name__)


class ConnectionManager(BroadcasterPort):
    """Verwaltet aktive WebSocket-Verbindungen und broadcastet Nachrichten."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        """Akzeptiert eine neue Verbindung und registriert sie."""
        await websocket.accept()
        self._connections.add(websocket)
        logger.info("Client verbunden (%d aktiv)", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        """Entfernt eine Verbindung aus dem Pool."""
        self._connections.discard(websocket)
        logger.info("Client getrennt (%d aktiv)", len(self._connections))

    async def broadcast(self, envelope: Envelope) -> None:
        """Sendet eine Nachricht an alle Clients; tote Verbindungen werden entfernt."""
        payload = envelope.model_dump(mode="json")
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(payload)
            except Exception:  # noqa: BLE001 - tote Verbindung tolerieren
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)
