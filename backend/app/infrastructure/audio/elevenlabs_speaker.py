"""Infrastructure: TTS via ElevenLabs.

Implementiert den ``SpeakerPort`` gegen die ElevenLabs-API — natürliche, sehr
menschlich klingende Stimmen (inkl. femininer). Synthetisiert deutschen Text
über das mehrsprachige Modell und liefert MP3-Bytes.

    POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=…
    Header: xi-api-key

Graceful Degradation: Bei Fehler/fehlendem Key → ``None`` (Frontend zeigt Text).
"""

from __future__ import annotations

import logging

import httpx

from app.application.ports.speaker_port import SpeakerPort
from app.core.config import Settings

logger = logging.getLogger(__name__)


class ElevenLabsSpeaker(SpeakerPort):
    """TTS-Adapter auf Basis der ElevenLabs-API."""

    content_type = "audio/mpeg"  # MP3

    def __init__(self, settings: Settings) -> None:
        self._enabled = settings.tts_enabled
        self._api_key = settings.elevenlabs_api_key
        self._voice_id = settings.elevenlabs_voice_id
        self._model = settings.elevenlabs_model
        self._output_format = settings.elevenlabs_output_format

    async def synthesize(self, text: str) -> bytes | None:
        if not self._enabled or not self._api_key or not text.strip():
            return None

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self._voice_id}"
        params = {"output_format": self._output_format}
        headers = {"xi-api-key": self._api_key, "Content-Type": "application/json"}
        body = {
            "text": text,
            "model_id": self._model,
            "voice_settings": {
                "stability": 0.4,
                "similarity_boost": 0.8,
                "style": 0.2,
                "use_speaker_boost": True,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(url, params=params, headers=headers, json=body)
                res.raise_for_status()
                return res.content
        except httpx.HTTPError as exc:
            logger.error("ElevenLabs-TTS fehlgeschlagen: %s", exc)
            return None
