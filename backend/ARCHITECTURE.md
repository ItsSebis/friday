# Backend-Architektur

Das Backend folgt **Clean Architecture**. Abhängigkeiten zeigen ausschließlich
nach innen (`api → application → domain`). Die innerste Schicht (`domain`) kennt
keine Frameworks.

```
app/
├── domain/          # Enterprise-Regeln (framework-frei)
│   ├── states.py        FridayState – die Zustandsmaschine
│   ├── messages.py      WebSocket-Protokoll (Envelope + typisierte Nachrichten)
│   └── agent_events.py  TextDelta / ToolProgress – Streaming-Events des Agenten
│
├── application/     # Anwendungsfälle & Ports (Interfaces, framework-frei)
│   ├── ports/
│   │   ├── agent_port.py        AgentPort – Hermes-Schnittstelle (streamt AgentEvents)
│   │   ├── broadcaster_port.py  BroadcasterPort – Ausgang an Clients
│   │   ├── transcriber_port.py  TranscriberPort – STT
│   │   └── speaker_port.py      SpeakerPort – TTS
│   └── services/
│       ├── session_service.py   Orchestriert die Sprach-Session (Zustände + Stream)
│       └── audio_store.py       Kurzlebiger Cache für TTS-WAVs
│
├── infrastructure/  # Adapter zu externen Systemen (implementieren die Ports)
│   ├── hermes/          HermesAgent – ruft den OpenAI-kompatiblen Hermes-API-Server (SSE)
│   ├── audio/           WhisperTranscriber (whisper.cpp) · PiperSpeaker (piper)
│   ├── widgets/         WeatherService (Open-Meteo) · SpotifyService (OAuth)
│   └── telegram/        Telegram-Gateway (Stub)
│
├── api/             # Interface-Adapter: FastAPI
│   ├── connection_manager.py  Verwaltet WebSocket-Verbindungen (BroadcasterPort)
│   ├── websocket.py           /ws – übersetzt WS ↔ Domain
│   ├── voice.py               /voice/stt (Upload) · /voice/tts/{id} (Auslieferung)
│   ├── widgets.py             /widgets/weather · /widgets/spotify (request-basiert)
│   ├── debug.py               /debug/* (nur development)
│   └── routes.py              /health · /meta
│
├── core/            # Querschnitt: Konfiguration
│   └── config.py        Settings (pydantic-settings, aus .env)
│
└── main.py          # Composition Root: verdrahtet Adapter mit Ports & startet FastAPI
```

## Abhängigkeitsregel

- `domain` importiert **nichts** aus den anderen Schichten.
- `application` importiert nur `domain` (und definiert Ports als ABCs).
- `infrastructure` und `api` hängen von `application`/`domain` ab — niemals umgekehrt.
- `main.py` ist der einzige Ort, an dem konkrete Implementierungen instanziiert
  und injiziert werden (Dependency Injection / Composition Root).

## Datenfluss (eine Sprachinteraktion)

1. USB-Mikrofon → Wakeword erkannt → `SessionService` setzt Zustand `listening`.
2. `SessionService` broadcastet `state.changed` über den `ConnectionManager`.
3. Transkript fertig → Zustand `thinking` → `AgentPort.handle(...)` (Hermes).
4. Hermes streamt Antwort → Zustand `speaking` → `response.delta`-Nachrichten.
5. TTS fertig → Zustand `idle`.

> Im aktuellen Grundgerüst sind die Schritte als dokumentierte Stubs angelegt —
> es findet **keine** echte Audio-/LLM-Verarbeitung statt.
