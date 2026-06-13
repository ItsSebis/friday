"""API: Voice-Endpoints (STT-Upload & TTS-Auslieferung).

- ``POST /voice/stt``: Das Frontend lädt die Mikrofonaufnahme (16-kHz-Mono-WAV)
  hoch. Wir transkribieren synchron und stoßen die Agenten-Verarbeitung als
  Hintergrund-Task an (Fortschritt läuft über den WebSocket). Der erkannte Text
  wird sofort zurückgegeben.
- ``GET /voice/tts/{audio_id}``: Liefert ein zuvor synthetisiertes WAV aus dem
  ``AudioStore`` (vom Frontend nach einer ``audio.speak``-Nachricht angefordert).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import Response

from app.application.ports.transcriber_port import TranscriberPort
from app.application.services.audio_store import AudioStore
from app.application.services.session_service import SessionService

logger = logging.getLogger(__name__)


def build_voice_router(
    session: SessionService,
    transcriber: TranscriberPort,
    audio_store: AudioStore,
) -> APIRouter:
    """Erzeugt den Voice-Router mit injizierten Abhängigkeiten."""
    router = APIRouter(prefix="/voice", tags=["voice"])

    @router.post("/stt")
    async def stt(audio: UploadFile, background: BackgroundTasks) -> dict[str, str]:
        wav_bytes = await audio.read()
        transcript = await transcriber.transcribe(wav_bytes)
        logger.info("STT: %d Bytes Audio → %r", len(wav_bytes), transcript)
        if not transcript.strip():
            logger.warning(
                "Leeres Transkript — STT lieferte nichts. Modell/Binary prüfen "
                "(STT_BINARY/STT_MODEL) und Backend-Log auf whisper-Fehler ansehen."
            )
        # Agenten-Turn im Hintergrund verarbeiten (Antwort/Tools laufen über WS).
        background.add_task(session.on_transcript_final, transcript)
        return {"transcript": transcript}

    @router.get("/tts/{audio_id}")
    async def tts(audio_id: str) -> Response:
        clip = audio_store.get(audio_id)
        if clip is None:
            raise HTTPException(404, "Audio nicht gefunden oder abgelaufen")
        data, content_type = clip
        return Response(content=data, media_type=content_type)

    return router
