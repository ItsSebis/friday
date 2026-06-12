"""Infrastructure: TTS via piper.

Implementiert den ``SpeakerPort`` durch Aufruf des piper-CLI als Subprozess.
Der Text wird über stdin übergeben; piper schreibt ein WAV in eine Temp-Datei,
die wir als Bytes zurückgeben.

Graceful Degradation: Ist TTS deaktiviert oder die Binary/Stimme nicht
vorhanden, wird ``None`` zurückgegeben — das Frontend zeigt dann nur den Text.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path

from app.application.ports.speaker_port import SpeakerPort
from app.core.config import Settings

logger = logging.getLogger(__name__)


class PiperSpeaker(SpeakerPort):
    """TTS-Adapter auf Basis von piper."""

    def __init__(self, settings: Settings) -> None:
        self._enabled = settings.tts_enabled
        self._binary = settings.tts_binary
        self._voice = settings.tts_voice

    async def synthesize(self, text: str) -> bytes | None:
        if not self._enabled or not text.strip():
            return None

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "out.wav"
            # Kurze Flags (-m/-f) sind versionsübergreifend stabil; Text via stdin.
            args = [self._binary, "-m", self._voice, "-f", str(out_path)]
            try:
                proc = await asyncio.create_subprocess_exec(
                    *args,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr = await proc.communicate(input=text.encode("utf-8"))
            except FileNotFoundError:
                logger.error("TTS-Binary nicht gefunden: %s (TTS übersprungen)", self._binary)
                return None

            if proc.returncode != 0 or not out_path.exists():
                logger.error("piper fehlgeschlagen: %s", stderr.decode(errors="ignore"))
                return None

            return out_path.read_bytes()
