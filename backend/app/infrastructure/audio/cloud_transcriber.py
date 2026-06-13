"""Infrastructure: STT über eine OpenAI-kompatible Cloud-API.

Implementiert den ``TranscriberPort`` gegen den ``/audio/transcriptions``-Endpoint
(OpenAI-kompatibel). Funktioniert mit **Groq** (Whisper large-v3-turbo, kostenloser
Tier, sehr akkurat) ebenso wie mit OpenAI — nur ``stt_api_base``/``stt_cloud_model``
unterscheiden sich.

    POST {base}/audio/transcriptions   (multipart: file, model, language)
    Header: Authorization: Bearer <key>

Graceful Degradation: Bei Fehler/fehlendem Key → leerer String.
"""

from __future__ import annotations

import logging

import httpx

from app.application.ports.transcriber_port import TranscriberPort
from app.core.config import Settings

logger = logging.getLogger(__name__)


class CloudTranscriber(TranscriberPort):
    """STT-Adapter für OpenAI-kompatible Transkriptions-APIs (Groq/OpenAI)."""

    def __init__(self, settings: Settings) -> None:
        self._base = settings.stt_api_base.rstrip("/")
        self._key = settings.stt_api_key
        self._model = settings.stt_cloud_model
        self._language = settings.stt_language

    async def transcribe(self, wav_bytes: bytes) -> str:
        if not self._key:
            logger.error("Cloud-STT ohne API-Key (STT_API_KEY) – übersprungen.")
            return ""

        url = f"{self._base}/audio/transcriptions"
        files = {"file": ("speech.wav", wav_bytes, "audio/wav")}
        data = {
            "model": self._model,
            "language": self._language,
            "response_format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {self._key}"},
                    files=files,
                    data=data,
                )
                res.raise_for_status()
                return (res.json().get("text") or "").strip()
        except httpx.HTTPError as exc:
            logger.error("Cloud-STT fehlgeschlagen: %s", exc)
            return ""
