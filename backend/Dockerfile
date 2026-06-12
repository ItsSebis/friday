# Friday Backend – FastAPI + Voice-Orchestrierung
# Multi-arch-fähig (Raspberry Pi 5 = arm64).
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Systemabhängigkeiten:
#  - ffmpeg: Audio-Hilfen
#  - piper (TTS) wird per pip installiert und liefert das `piper`-CLI
# whisper.cpp (STT) ist NICHT enthalten — Binary + ggml-Modell bereitstellen
# (z. B. auf dem Pi bauen und via /models mounten) und STT_BINARY/STT_MODEL setzen.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python-Kernabhängigkeiten zuerst → besserer Layer-Cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# TTS-Engine (optional; App degradiert sauber, falls Synthese fehlschlägt).
RUN pip install --no-cache-dir piper-tts || echo "piper-tts nicht installiert – TTS deaktiviert"

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
