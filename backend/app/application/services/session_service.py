"""Application-Service: Orchestriert eine Interaktions-Session.

Der ``SessionService`` ist der Anwendungsfall-Kern von Friday. Er hält den
aktuellen Zustand, erzwingt erlaubte Übergänge und steuert den vollständigen
Lebenszyklus einer Sprachinteraktion:

    listening → (Transkript) → thinking → (Agenten-Stream) → speaking → idle

Er kennt nur Ports und die Domain — keine konkrete Infrastruktur.
"""

from __future__ import annotations

import asyncio
import logging

from app.application.ports.agent_port import AgentPort
from app.application.ports.broadcaster_port import BroadcasterPort
from app.application.ports.speaker_port import SpeakerPort
from app.application.services.audio_store import AudioStore
from app.domain.agent_events import TextDelta, ToolProgress
from app.domain.messages import (
    AudioSpeakPayload,
    Envelope,
    MessageType,
    ResponsePayload,
    StateChangedPayload,
    ToolEventPayload,
    TranscriptPayload,
)
from app.domain.states import FridayState, can_transition

logger = logging.getLogger(__name__)


class SessionService:
    """Steuert Zustandsübergänge und den Gesprächsablauf einer Session."""

    def __init__(
        self,
        agent: AgentPort,
        broadcaster: BroadcasterPort,
        speaker: SpeakerPort,
        audio_store: AudioStore,
    ) -> None:
        self._agent = agent
        self._broadcaster = broadcaster
        self._speaker = speaker
        self._audio_store = audio_store
        self._state = FridayState.IDLE
        # Verhindert überlappende Turns (z. B. zweites STT während Verarbeitung).
        self._lock = asyncio.Lock()

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

    # ── Lebenszyklus einer Interaktion ────────────────────────────────

    async def on_listen_start(self) -> None:
        """Nutzer startet die Aufnahme (Push-to-talk/Wakeword) → Listening."""
        await self.transition_to(FridayState.LISTENING)

    async def on_listen_cancel(self) -> None:
        """Aufnahme ohne Ergebnis abgebrochen → zurück zu Idle."""
        if self._state == FridayState.LISTENING:
            await self.transition_to(FridayState.IDLE)

    async def on_transcript_final(self, transcript: str) -> None:
        """Verarbeitet finalen Nutzertext: Agent befragen, Antwort sprechen.

        Läuft typischerweise als Hintergrund-Task (vom STT-Endpoint gestartet),
        damit der HTTP-Request nicht bis zum Ende blockiert. Der Fortschritt
        wird über den WebSocket gebroadcastet.
        """
        if not transcript.strip():
            await self.on_listen_cancel()
            return

        async with self._lock:
            # Transkript anzeigen.
            await self._broadcaster.broadcast(
                Envelope.of(
                    MessageType.TRANSCRIPT, TranscriptPayload(text=transcript, final=True)
                )
            )

            # Agent verarbeiten (thinking). Übergang nach THINKING ist nur aus
            # LISTENING erlaubt → ggf. zuerst dorthin wechseln (z. B. STT ohne
            # vorheriges listen.start).
            if self._state != FridayState.LISTENING:
                await self.transition_to(FridayState.LISTENING)
            await self.transition_to(FridayState.THINKING)
            response_text = await self._run_agent(transcript)

            # Antwort sprechen (speaking).
            await self.transition_to(FridayState.SPEAKING)
            await self._speak(response_text)

    async def _run_agent(self, transcript: str) -> str:
        """Streamt die Agenten-Antwort und broadcastet Deltas + Tool-Events."""
        response_text = ""
        async for event in self._agent.handle(transcript):
            if isinstance(event, TextDelta):
                response_text += event.text
                await self._broadcaster.broadcast(
                    Envelope.of(MessageType.RESPONSE, ResponsePayload(text=event.text))
                )
            elif isinstance(event, ToolProgress):
                await self._broadcaster.broadcast(
                    Envelope.of(
                        MessageType.TOOL_EVENT,
                        ToolEventPayload(
                            tool=event.tool,
                            status=event.status,  # type: ignore[arg-type]
                            detail=event.detail,
                        ),
                    )
                )
        await self._broadcaster.broadcast(
            Envelope.of(MessageType.RESPONSE, ResponsePayload(text="", complete=True))
        )
        return response_text

    async def _speak(self, text: str) -> None:
        """Synthetisiert die Antwort (falls TTS aktiv) und sendet sie ans Frontend.

        Bei verfügbarem TTS wartet das Backend auf ``speak.done`` (Frontend hat
        zu Ende gespielt). Ohne TTS wird direkt zurück nach Idle gewechselt.
        """
        wav = await self._speaker.synthesize(text)
        audio_url = None
        if wav:
            audio_id = self._audio_store.put(wav, self._speaker.content_type)
            audio_url = f"/voice/tts/{audio_id}"

        await self._broadcaster.broadcast(
            Envelope.of(MessageType.AUDIO_SPEAK, AudioSpeakPayload(audio_url=audio_url, text=text))
        )

        if audio_url is None:
            # Kein Audio → Frontend zeigt nur Text; nach kurzer Lesezeit zurück.
            await self.transition_to(FridayState.IDLE)

    async def on_speak_done(self) -> None:
        """TTS-Wiedergabe im Frontend beendet → zurück zu Idle."""
        if self._state == FridayState.SPEAKING:
            await self.transition_to(FridayState.IDLE)

    async def on_interrupt(self) -> None:
        """Nutzer bricht ab → zurück in den Idle-Zustand."""
        await self.transition_to(FridayState.IDLE)

    # ── Debug ──────────────────────────────────────────────────────────

    async def force_state(self, target: FridayState) -> None:
        """DEBUG: erzwingt einen Zustand OHNE Übergangsprüfung und broadcastet ihn."""
        self._state = target
        await self._broadcaster.broadcast(
            Envelope.of(MessageType.STATE_CHANGED, StateChangedPayload(state=target))
        )
