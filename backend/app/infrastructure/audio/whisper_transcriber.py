"""Infrastructure: STT via whisper.cpp.

Implementiert den ``TranscriberPort`` durch Aufruf des whisper.cpp-CLI als
Subprozess. Erwartet 16-kHz-Mono-WAV (liefert das Frontend bereits so).

Graceful Degradation: Fehlt die Binary oder das Modell, wird geloggt und ein
leerer String zurückgegeben — die App bleibt lauffähig (z. B. lokal ohne Pi).
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path

from app.application.ports.transcriber_port import TranscriberPort
from app.core.config import Settings

logger = logging.getLogger(__name__)


class WhisperTranscriber(TranscriberPort):
    """STT-Adapter auf Basis von whisper.cpp."""

    def __init__(self, settings: Settings) -> None:
        self._binary = settings.stt_binary
        self._model = settings.stt_model
        self._language = settings.stt_language

    async def transcribe(self, wav_bytes: bytes) -> str:
        if not Path(self._model).exists():
            logger.error(
                "STT-Modell nicht gefunden: %s — STT_MODEL auf eine echte .bin-Datei "
                "setzen (lokal NICHT der Docker-Pfad /models/...).",
                self._model,
            )
            return ""
        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "in.wav"
            out_base = Path(tmp) / "out"
            wav_path.write_bytes(wav_bytes)

            args = [
                self._binary,
                "-m", self._model,
                "-f", str(wav_path),
                "-l", self._language,
                "-nt",            # keine Zeitstempel
                "-otxt",          # Textdatei schreiben
                "-of", str(out_base),
            ]
            try:
                proc = await asyncio.create_subprocess_exec(
                    *args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr = await proc.communicate()
            except FileNotFoundError:
                logger.error("STT-Binary nicht gefunden: %s (STT übersprungen)", self._binary)
                return ""

            if proc.returncode != 0:
                logger.error("whisper.cpp fehlgeschlagen: %s", stderr.decode(errors="ignore"))
                return ""

            txt_file = out_base.with_suffix(".txt")
            if not txt_file.exists():
                return ""
            return txt_file.read_text(encoding="utf-8", errors="ignore").strip()
