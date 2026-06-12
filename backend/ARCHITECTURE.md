# Backend-Architektur

Das Backend folgt **Clean Architecture**. Abhängigkeiten zeigen ausschließlich
nach innen (`api → application → domain`). Die innerste Schicht (`domain`) kennt
keine Frameworks.

```
app/
├── domain/          # Enterprise-Regeln: Zustände & Nachrichten-Verträge (framework-frei)
│   ├── states.py        FridayState – die Zustandsmaschine
│   └── messages.py      WebSocket-Protokoll (Envelope + typisierte Nachrichten)
│
├── application/     # Anwendungsfälle & Ports (Interfaces, framework-frei)
│   ├── ports/
│   │   └── agent_port.py     AgentPort – Schnittstelle, die Hermes erfüllen muss
│   └── services/
│       └── session_service.py  Orchestriert eine Gesprächs-Session (Zustandsübergänge)
│
├── infrastructure/  # Adapter zu externen Systemen (implementieren die Ports)
│   ├── hermes/          HermesAgent – AgentPort-Implementierung (Stub)
│   ├── openrouter/      OpenRouter-LLM-Client (Stub)
│   └── telegram/        Telegram-Gateway (Stub)
│
├── api/             # Interface-Adapter: FastAPI, WebSocket-Gateway
│   ├── connection_manager.py  Verwaltet aktive WebSocket-Verbindungen
│   ├── websocket.py           /ws Endpoint – übersetzt WS ↔ Domain-Nachrichten
│   └── routes.py              HTTP-Health-/Meta-Endpoints
│
├── core/            # Querschnitt: Konfiguration, Logging
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
