"""Application-Service: Orchestriert eine Interaktions-Session.

Der ``SessionService`` ist der Anwendungsfall-Kern von Friday. Er hält den
aktuellen Zustand, erzwingt erlaubte Übergänge und übersetzt den Lebenszyklus
einer Sprachinteraktion in Domain-Nachrichten, die er über den
``BroadcasterPort`` an die Clients sendet.

Er kennt nur Ports und die Domain — keine konkrete Infrastruktur.

> Grundgerüst: Die Methoden zeigen den vorgesehenen Ablauf als dokumentierte
> Stubs. Es ist bewusst keine Audio-/LLM-Verarbeitung implementiert.
"""

from __future__ import annotations

import logging

from app.application.ports.agent_port import AgentPort
from app.application.ports.broadcaster_port import BroadcasterPort
from app.domain.messages import (
    Envelope,
    MessageType,
    ResponsePayload,
    StateChangedPayload,
)
from app.domain.states import FridayState, can_transition

logger = logging.getLogger(__name__)


class SessionService:
    """Steuert Zustandsübergänge und die Kommunikation einer Session."""

    def __init__(self, agent: AgentPort, broadcaster: BroadcasterPort) -> None:
        self._agent = agent
        self._broadcaster = broadcaster
        self._state = FridayState.IDLE

    @property
    def state(self) -> FridayState:
        return self._state

    async def transition_to(self, target: FridayState) -> None:
        """Wechselt den Zustand (sofern erlaubt) und broadcastet ihn."""
        if target == self._state:
            return
        if not can_transition(self._state, target):
            logger.warning("Unerlaubter Übergang: %s → %s", self._state, target)
            return

        self._state = target
        await self._broadcaster.broadcast(
            Envelope.of(MessageType.STATE_CHANGED, StateChangedPayload(state=target))
        )

    # ── Lebenszyklus einer Interaktion (Stubs) ────────────────────────

    async def on_wakeword(self) -> None:
        """Wakeword erkannt → in den Listening-Zustand wechseln."""
        await self.transition_to(FridayState.LISTENING)

    async def on_transcript_final(self, transcript: str) -> None:
        """Finaler Transkript-Text → Agent verarbeitet, dann Antwort sprechen.

        TODO(Businesslogik): Audio-Capture/STT anbinden; hier liegt nur der
        vorgesehene Ablauf.
        """
        await self.transition_to(FridayState.THINKING)

        await self.transition_to(FridayState.SPEAKING)
        async for delta in self._agent.handle(transcript):
            await self._broadcaster.broadcast(
                Envelope.of(MessageType.RESPONSE, ResponsePayload(text=delta))
            )
        await self._broadcaster.broadcast(
            Envelope.of(MessageType.RESPONSE, ResponsePayload(text="", complete=True))
        )

        await self.transition_to(FridayState.IDLE)

    async def on_interrupt(self) -> None:
        """Nutzer bricht ab → zurück in den Idle-Zustand."""
        await self.transition_to(FridayState.IDLE)
