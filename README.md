# Friday

Ein physischer KI-Bilderrahmen im Stil von Iron Mans **FRIDAY**.

Friday läuft als Kiosk-Anwendung auf einem Raspberry Pi 5 und kombiniert einen
ambienten Bilderrahmenmodus mit einem sprachgesteuerten KI-Assistenten. Die
Sprachlogik, das Gedächtnis und die Tool-Integration übernimmt der **Hermes
Agent**; das Frontend ist eine reine Präsentationsschicht.

> **Status: Beta.** Die vollständige Sprach-Pipeline ist real verdrahtet —
> Mikrofonaufnahme im Browser, lokale Spracherkennung (whisper.cpp), der
> [Hermes Agent](https://hermes-agent.nousresearch.com/) als OpenAI-kompatibler
> Backend-Server und lokale Sprachausgabe (piper). Die Idle-Widgets holen ihre
> Daten request-basiert über REST. Externe Abhängigkeiten (laufender Hermes,
> STT-/TTS-Modelle, optional Spotify-OAuth) müssen auf dem Pi bereitstehen —
> siehe [Voraussetzungen](#voraussetzungen) und [Voice-Pipeline](#voice-pipeline-echter-betrieb).

---

## Inhalt

- [Hardware](#hardware)
- [Software-Architektur](#software-architektur)
- [Zustände](#zustände)
- [Projektstruktur](#projektstruktur)
- [Voraussetzungen](#voraussetzungen)
- [Entwicklung](#entwicklung)
  - [Konfiguration (.env)](#konfiguration-env)
  - [Backend starten](#backend-starten)
  - [Frontend starten](#frontend-starten)
  - [Verfügbare Skripte](#verfügbare-skripte)
- [Voice-Pipeline (echter Betrieb)](#voice-pipeline-echter-betrieb)
- [Dev-Werkzeuge](#dev-werkzeuge)
- [WebSocket-Protokoll](#websocket-protokoll)
- [Deployment (Docker)](#deployment-docker)
- [Raspberry-Pi-Kiosk-Setup](#raspberry-pi-kiosk-setup)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Hardware

| Komponente              | Beschreibung                          |
|-------------------------|---------------------------------------|
| Raspberry Pi 5          | Host für Backend + Kiosk-Browser      |
| USB-Mikrofon            | Audio-Eingang (Wakeword, Sprache)     |
| Lautsprecher            | Audio-Ausgang (TTS)                   |
| HDMI / USB-C Bildschirm | Anzeige im Hoch- oder Querformat      |

## Software-Architektur

Friday folgt **Clean-Architecture-Prinzipien**. Abhängigkeiten zeigen immer nach
innen — die UI und die Frameworks (FastAPI, React) sind austauschbare Details.

```
┌──────────────────────────────────────────────────────────────┐
│                        Raspberry Pi 5                          │
│                                                                │
│   ┌────────────────────┐        ┌───────────────────────────┐ │
│   │  Frontend (Kiosk)  │  WS    │   Backend (FastAPI)        │ │
│   │  React + TS + Vite │◄──────►│   WebSocket Gateway        │ │
│   │                    │  JSON  │                            │ │
│   │  • Bilderrahmen    │        │   ┌──────────────────────┐ │ │
│   │  • Visualizer      │        │   │   Hermes Agent       │ │ │
│   │  • Statusanzeige   │        │   │   • Agentenlogik     │ │ │
│   │  • Tool Panels     │        │   │   • Memory           │ │ │
│   │  • Dashboard       │        │   │   • Tool Calling     │ │ │
│   └────────────────────┘        │   │   • Telegram         │ │ │
│                                 │   │   • OpenRouter       │ │ │
│                                 │   └──────────────────────┘ │ │
│                                 └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Zuständigkeiten

**Hermes Agent** — eigenständiger Prozess (OpenAI-kompatibler API-Server, Port
8642): Agentenlogik, Memory, Tool Calling, OpenRouter-Anbindung. Das
Friday-Backend ruft ihn über den `AgentPort`.

**Friday-Backend (FastAPI)** — Orchestriert die Sprach-Session (Zustandsmaschine),
betreibt lokale STT (whisper.cpp) und TTS (piper), liefert die Widget-Daten per
REST und broadcastet den Zustand über WebSocket.

**Frontend (Kiosk)** — Bilderrahmenmodus (Idle), Mikrofonaufnahme (getUserMedia),
echter Audio-Visualizer, Sprachstatus, Tool-Panels, Dashboard (Uhr, Wetter, Spotify).

### Datenfluss einer Sprachinteraktion

```
Browser (Kiosk)                    Friday-Backend                    Hermes (:8642)
───────────────                    ──────────────                    ─────────────
Tippen → getUserMedia
  ├─ Mikrofonpegel ─────────────►  (Visualizer, live)
  └─ 16-kHz-WAV ──POST /voice/stt► whisper.cpp → Transkript
                                   SessionService:
                                     thinking ──/v1/chat/completions──► Hermes → OpenRouter
                                     ◄── Antwort-Deltas + tool.progress (SSE)
                                     speaking → piper → WAV (AudioStore)
TTS abspielen ◄── GET /voice/tts/{id} ──┘   (WS: state, response, tool.event, audio.speak)
  └─ Wiedergabepegel ───────────►  (Visualizer)
speak.done ───────────────────►   idle

Idle-Widgets ──poll──► GET /widgets/weather (Open-Meteo) · /widgets/spotify (OAuth)
```

Detaillierte Layer-Dokumentation:
- [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md)
- [`frontend/ARCHITECTURE.md`](frontend/ARCHITECTURE.md)

## Zustände

Das System ist eine endliche Zustandsmaschine. Das **Backend ist die Source of
Truth**; das Frontend rendert nur den empfangenen Zustand.

| Zustand     | Auslöser                | Frontend-Darstellung                       |
|-------------|-------------------------|--------------------------------------------|
| `idle`      | Standard                | Bildrotation, Uhr, Wetter, Spotify         |
| `listening` | Wakeword erkannt        | Kreisförmiger Visualizer, Statusanzeige    |
| `thinking`  | Anfrage in Bearbeitung  | Verarbeitungs-Animation                    |
| `speaking`  | Antwort wird ausgegeben | Visualizer, Antworttext                    |

```
        Wakeword            Transkript fertig         Antwort fertig
 idle ────────────► listening ───────────► thinking ──────────► speaking ──┐
   ▲                    │                      │                            │
   │                    │ (Abbruch)            │ (Abbruch)                  │
   └────────────────────┴──────────────────────┴────────────────────────────┘
                                  (zurück zu idle)
```

Definiert in `backend/app/domain/states.py`, gespiegelt in
`frontend/src/domain/states.ts`.

## Projektstruktur

```
friday/
├── frontend/   React-Kiosk-App  (domain → application → infrastructure → presentation)
├── backend/    FastAPI + Hermes (domain → application → infrastructure → api)
├── docker/     Container- & Kiosk-Setup (Nginx, Autostart-Skript)
├── assets/     Bilder, Schriften, Sounds
├── docker-compose.yml
├── .env.example
└── README.md
```

## Voraussetzungen

### Lokale Entwicklung

| Tool      | Version       | Hinweis                                              |
|-----------|---------------|------------------------------------------------------|
| Python    | **3.11 – 3.12** | **Nicht 3.14** (siehe [Troubleshooting](#troubleshooting)) |
| Node.js   | ≥ 20 (getestet 22) | inkl. npm                                       |
| Docker    | ≥ 24 + Compose v2 | nur für Deployment / Containertests             |

### Produktion (Raspberry Pi 5)

- Raspberry Pi OS (64-bit / arm64)
- Docker + Docker Compose
- Chromium (für den Kiosk-Browser)

### Externe Dienste für den echten Betrieb

| Abhängigkeit | Wofür | Hinweis |
|---|---|---|
| **Hermes Agent** | Agentenlogik + LLM | Läuft als eigener Prozess; API-Server auf `:8642`. Mit OpenRouter konfigurieren. |
| **whisper.cpp** + ggml-Modell | Spracherkennung (STT) | Binary im PATH (`STT_BINARY`), Modell unter `STT_MODEL`. |
| **piper** + Stimme (.onnx) | Sprachausgabe (TTS) | Binary (`TTS_BINARY`) + Stimme (`TTS_VOICE`); im Docker-Image per pip. |
| Spotify-OAuth-App | Spotify-Widget (optional) | Nur falls das Now-Playing-Widget genutzt wird. |

> Fehlt eine dieser Abhängigkeiten, bleibt Friday lauffähig (Graceful
> Degradation): ohne Hermes kommt eine Hinweis-Antwort, ohne STT ein leeres
> Transkript, ohne TTS wird die Antwort nur angezeigt.

---

## Entwicklung

```bash
git clone <repo-url> friday
cd friday
cp .env.example .env          # Werte eintragen (siehe unten)
```

### Konfiguration (.env)

Alle Geheimnisse und Laufzeit-Einstellungen liegen in `.env` (aus
`.env.example`). **Niemals committen** — bereits in `.gitignore`.

| Variable                  | Zweck                                          |
|---------------------------|------------------------------------------------|
| `FRIDAY_HOST` / `FRIDAY_PORT` | Bind-Adresse des Backends                  |
| `FRIDAY_ALLOWED_ORIGINS`  | Erlaubte CORS-/WS-Origins (kommagetrennt)      |
| `HERMES_BASE_URL` / `HERMES_API_KEY` | Adresse + Bearer-Key des Hermes-API-Servers |
| `STT_BINARY` / `STT_MODEL` / `STT_LANGUAGE` | whisper.cpp-CLI, Modellpfad, Sprache |
| `TTS_ENABLED` / `TTS_BINARY` / `TTS_VOICE` | piper an/aus, CLI, Stimmen-Datei |
| `WEATHER_LAT` / `WEATHER_LON` | Standort fürs Wetter-Widget (Open-Meteo)   |
| `SPOTIFY_CLIENT_ID/_SECRET/_REFRESH_TOKEN` | Spotify-Widget (optional)         |
| `VITE_WS_URL`             | WS-URL fürs Frontend (Dev; leer = gleicher Origin) |

> Das Frontend liest Vite-Variablen aus `frontend/.env`. Für lokale Entwicklung
> existiert dort eine eigene `frontend/.env.example` — bei Bedarf kopieren.

### Backend starten

```bash
cd backend

# venv mit Python 3.11 (WICHTIG, nicht 3.14 — siehe Troubleshooting)
python3.11 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

# Dev-Server mit Auto-Reload
uvicorn app.main:app --reload --port 8000
```

Erreichbar danach:

- Health-Check: <http://localhost:8000/health>
- Metadaten:    <http://localhost:8000/meta>
- API-Docs (FastAPI/Swagger): <http://localhost:8000/docs>
- WebSocket:    `ws://localhost:8000/ws`

### Frontend starten

```bash
cd frontend
npm install        # einmalig
npm run dev        # Vite-Dev-Server auf Port 5173 (host: true → auch im LAN)
```

Frontend: <http://localhost:5173>. Es verbindet sich automatisch mit dem
Backend-WebSocket (`VITE_WS_URL`, Default `ws://localhost:8000/ws`) und baut bei
Verbindungsabbruch per Backoff automatisch neu auf.

> **Reihenfolge:** Backend zuerst starten, dann Frontend — sonst zeigt das
> Frontend so lange den Idle-Zustand und reconnectet im Hintergrund.

### Verfügbare Skripte

**Frontend** (`cd frontend`):

| Befehl              | Wirkung                                       |
|---------------------|-----------------------------------------------|
| `npm run dev`       | Dev-Server mit HMR                            |
| `npm run build`     | Typecheck (`tsc -b`) + Produktions-Build      |
| `npm run preview`   | Lokale Vorschau des Produktions-Builds (4173) |
| `npm run typecheck` | Nur Typprüfung, kein Output                   |

**Backend** (`cd backend`, venv aktiv):

| Befehl                                       | Wirkung                  |
|----------------------------------------------|--------------------------|
| `uvicorn app.main:app --reload --port 8000`  | Dev-Server               |
| `ruff check app`                             | Linting (Konfig in `pyproject.toml`) |

---

## Voice-Pipeline (echter Betrieb)

So wird aus dem UI ein echter Sprachassistent. Reihenfolge: **Hermes** starten →
**STT/TTS-Modelle** bereitstellen → Friday starten.

### 1. Hermes Agent (Agent + LLM)

Hermes ist ein eigenständiges Open-Source-Projekt und läuft als separater
Prozess mit OpenAI-kompatiblem API-Server.

```bash
# Installation (siehe hermes-agent.nousresearch.com)
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes setup                      # interaktiv: OpenRouter wählen + API-Key

# API-Server aktivieren (Port 8642) – z. B. via Umgebung:
export API_SERVER_ENABLED=true
export API_SERVER_KEY=change-me-local-dev
hermes              # bzw. den Gateway/API-Server gemäß Hermes-Doku starten
```

In Friday passend setzen: `HERMES_BASE_URL=http://localhost:8642`,
`HERMES_API_KEY=change-me-local-dev`. Schnelltest:

```bash
curl http://localhost:8642/v1/chat/completions \
  -H "Authorization: Bearer change-me-local-dev" -H "Content-Type: application/json" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"Hallo!"}]}'
```

### 2. Spracherkennung – whisper.cpp (STT)

```bash
# whisper.cpp bauen (auf dem Pi) und ein Modell laden
git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp && make
bash ./models/download-ggml-model.sh base       # → ggml-base.bin
```

`STT_BINARY` auf das CLI (`whisper-cli`) und `STT_MODEL` auf das `.bin` zeigen
lassen (im Docker-Setup unter `/models`).

### 3. Sprachausgabe – piper (TTS)

```bash
pip install piper-tts        # liefert das `piper`-CLI (im Backend-Image enthalten)
# Deutsche Stimme nach docker/models/ laden (onnx + json):
BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium
curl -L -o docker/models/de_DE-thorsten-medium.onnx      $BASE/de_DE-thorsten-medium.onnx
curl -L -o docker/models/de_DE-thorsten-medium.onnx.json $BASE/de_DE-thorsten-medium.onnx.json
```

`TTS_VOICE` auf die `.onnx`-Stimme zeigen lassen (lokal `../docker/models/…`,
im Docker `/models/…`). TTS abschaltbar via `TTS_ENABLED=false`. piper läuft mit
aktiviertem venv (`source .venv/bin/activate`), damit das `piper`-CLI im PATH ist.

### 4. Bedienung

- **Tippen** (Touchscreen/Klick) irgendwo auf den Bildschirm startet/stoppt die
  Aufnahme; alternativ **Leertaste**.
- Der Visualizer reagiert **live** auf den echten Mikrofonpegel (Listening) bzw.
  die TTS-Wiedergabe (Speaking).
- **Wakeword** ist als Erweiterung vorgesehen (Hook in `TalkOverlay`); für die
  Beta dient Push-to-talk als Trigger.

### Chat-Verlauf

Während eines Gesprächs blendet sich ein **Chat-Widget** ein: deine Fragen
rechts, Fridays Antworten links. Die laufende Antwort erscheint wortweise mit
einer Rede-Animation (synchron zur TTS-Wiedergabe). Der Verlauf wird im Frontend
gehalten (letzte 20 Beiträge) und außerhalb von Idle angezeigt.

### Hintergrundbilder (Idle-Slideshow)

Lege einfach Bilder in den Bilderordner — sie werden im Idle-Modus mit
Crossfade und langsamem Ken-Burns-Zoom durchgewechselt (Wechsel alle 12 s). Neue
Dateien erscheinen automatisch (das Frontend pollt die Liste minütlich).

- **Ordner:** lokal `assets/images/`, im Docker das gemountete Volume → `/images`
  (`IMAGES_DIR` konfigurierbar).
- **Formate:** jpg, jpeg, png, webp, gif, avif.
- Endpoints: `GET /widgets/images` (Liste) · `GET /images/{datei}` (Auslieferung).
- Ohne Bilder zeigt der Idle-Screen einen dezenten Verlauf als Fallback.

### Mikrofonzugriff im Kiosk

`getUserMedia` braucht einen „secure context". `http://localhost` gilt als
sicher; bei Zugriff über eine LAN-IP Chromium ggf. mit
`--unsafely-treat-insecure-origin-as-secure=http://<ip>:8080` starten (im
Kiosk-Skript ergänzbar) oder HTTPS einrichten.

---

## Dev-Werkzeuge

Auch ohne Hardware/Hermes lässt sich das UI über ein **Dev-Toolkit** vollständig
durchspielen (Zustände, Pegel, Antworten, Widgets simulieren). Praktisch zum
Iterieren am UI, unabhängig von der echten Pipeline. Alle Werkzeuge sind
**strikt dev-only** und werden aus dem Produktions-Build ausgeschlossen
(Frontend per `import.meta.env.DEV`-Guard, Backend nur bei
`FRIDAY_ENV=development`).

### Dev-Konsole (Frontend)

Im Dev-Server (`npm run dev`) erscheint unten rechts ein **`` ` `` DEV**-Badge.

- **Taste «`» (Backtick)** blendet ein Terminal-Overlay ein/aus, **«Esc»** schließt es.
- Befehl eintippen + **Enter**; **↑/↓** blättert durch den Verlauf; **`help`** listet alles.

Die Konsole erzeugt exakt die Protokoll-Nachrichten, die das Backend später
selbst sendet — sie umgeht keine Logik.

| Befehl | Wirkung |
|---|---|
| `help` / `status` / `clear` | Hilfe, Status, leeren |
| `state <idle\|listening\|thinking\|speaking>` | Zustand **lokal** setzen (ohne Backend) |
| `interrupt` | **Echten** `ui.interrupt` an das Backend senden |
| `audio <0..1\|sim\|stop>` | Visualizer-Pegel setzen oder als Sinus simulieren |
| `transcript <text…>` | Nutzertext setzen (Listening-Screen) |
| `response <text…>` | Antwort anhängen (Speaking-Screen) |
| `tool <name> <started\|succeeded\|failed>` | Tool-Event für die Tool-Panels |
| `weather <°C> <bedingung…>` | **Wetter-Widget befüllen** |
| `spotify <track> \| <artist>` | **Spotify-Widget befüllen** |
| `dashboard` | Demo-Daten für Uhr, Wetter & Spotify auf einmal |
| `error <text…>` | Fehlermeldung in den Store setzen |
| `reset` | Transkript/Antwort/Audio leeren, zurück zu `idle` |
| `ws <state\|dashboard\|tool\|audio> …` | Über **Backend-Debug-Endpoints** broadcasten (echter End-to-End-Pfad) |

> **Lokal vs. `ws`:** Befehle ohne Präfix schreiben direkt in den Store
> (funktioniert auch ohne laufendes Backend). `ws …` ruft die Backend-Debug-API
> auf, die dann per WebSocket an **alle** Clients broadcastet.

Zusätzlich ist der Store im Dev-Modus als `window.fridayStore` verfügbar:

```js
window.fridayStore.getState().state            // aktueller Zustand
window.fridayStore.getState().applyServerMessage({ type: 'state.changed', payload: { state: 'thinking' } })
```

### Debug-Endpoints (Backend)

Nur bei `FRIDAY_ENV=development` registriert. Praktisch zum Testen per `curl`
oder als realer End-to-End-Durchstich (Broadcast an alle verbundenen Clients):

```bash
curl -X POST localhost:8000/debug/state/listening      # Zustand erzwingen
curl -X POST localhost:8000/debug/dashboard            # Demo: Uhr/Wetter/Spotify
curl -X POST localhost:8000/debug/audio/0.7            # Visualizer-Pegel
curl -X POST localhost:8000/debug/tool/weather/succeeded
```

### Wetter- & Spotify-Widgets

Die Widgets holen ihre Daten **request-basiert** (Polling über REST), nicht über
Hermes:

- **Wetter** (`GET /widgets/weather`): Open-Meteo, **kein API-Key**. Standort über
  `WEATHER_LAT`/`WEATHER_LON` in `.env`. Frontend pollt alle 10 min. Läuft sofort.
- **Spotify** (`GET /widgets/spotify`): optional, erfordert eine OAuth-App. Ohne
  Credentials bleibt das Widget leer. Frontend pollt alle 10 s.

**Spotify einrichten (einmalig):**

1. App auf <https://developer.spotify.com/dashboard> anlegen → `Client ID` + `Secret`.
2. Einmalig ein **Refresh-Token** mit Scope `user-read-currently-playing` erzeugen
   (Authorization-Code-Flow, z. B. via `spotipy` oder einem der gängigen
   Helper-Skripte).
3. `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` in `.env`
   setzen. Das Backend erneuert das Access-Token selbstständig.

> Zum reinen UI-Testen ohne echte Quellen weiterhin die [Dev-Konsole](#dev-werkzeuge)
> (`dashboard`, `weather …`, `spotify …`) oder `curl … /debug/dashboard` nutzen.

---

## WebSocket-Protokoll

Einziger Kommunikationskanal zwischen Backend und Frontend. Jede Nachricht ist
ein Envelope:

```json
{ "type": "state.changed", "payload": { "state": "listening" }, "timestamp": "…" }
```

`type` bestimmt das Schema von `payload`. Vertrag definiert in
`backend/app/domain/messages.py` und gespiegelt in
`frontend/src/domain/messages.ts` — **beide Seiten müssen synchron bleiben**.

**Server → Client:** `state.changed`, `audio.level`, `transcript`, `response`,
`tool.event`, `audio.speak` (TTS abspielen), `dashboard.update`, `error`.

**Client → Server:** `client.hello` (Handshake), `listen.start` / `listen.cancel`
(Aufnahme), `speak.done` (TTS fertig abgespielt), `ui.interrupt` (Abbruch).

> Die eigentliche Audioübertragung läuft **nicht** über WebSocket, sondern per
> HTTP: STT-Upload via `POST /voice/stt`, TTS-Abruf via `GET /voice/tts/{id}`.

---

## Deployment (Docker)

Container-basiertes Deployment für den Raspberry Pi 5 (arm64). Beide Images
bauen nativ auf dem Pi.

```bash
# Vom Repo-Root
cp .env.example .env          # Produktionswerte eintragen
docker compose up --build -d
```

Services:

| Service    | Port (Host) | Beschreibung                                  |
|------------|-------------|-----------------------------------------------|
| `backend`  | `8000`      | FastAPI + Hermes (mit Healthcheck)            |
| `frontend` | `8080`      | Nginx liefert die SPA, proxyt `/ws` & `/health` |

Danach:

- Frontend: <http://localhost:8080>
- Backend-Health: <http://localhost:8000/health>

Nginx (Frontend-Container) proxyt `/ws` und `/health|/meta` an das Backend —
Frontend und Backend teilen sich so **denselben Origin**, was Kiosk und CORS
vereinfacht. Die Nginx-Config (`docker/nginx/default.conf`) wird per Volume
gemountet (Single Source).

Nützliche Befehle:

```bash
docker compose logs -f backend     # Logs verfolgen
docker compose ps                  # Status / Health
docker compose down                # stoppen
docker compose up --build -d       # nach Änderungen neu bauen
```

Mehr Details: [`docker/README.md`](docker/README.md).

---

## Raspberry-Pi-Kiosk-Setup

1. **Container starten** (siehe oben) — laufen idealerweise per
   `restart: unless-stopped` automatisch beim Boot.

2. **Kiosk-Skript ausführbar machen:**

   ```bash
   chmod +x docker/kiosk/start-kiosk.sh
   ```

   Das Skript (`docker/kiosk/start-kiosk.sh`) startet Chromium im Vollbild-Kiosk
   auf die Frontend-URL, deaktiviert Bildschirmschoner/DPMS und blendet den
   Cursor aus.

3. **Autostart einrichten** — z. B. unter X11 in
   `~/.config/lxsession/LXDE-pi/autostart`:

   ```
   @bash /home/pi/friday/docker/kiosk/start-kiosk.sh
   ```

   URL bei Bedarf überschreiben:

   ```bash
   FRIDAY_URL=http://localhost:8080 bash docker/kiosk/start-kiosk.sh
   ```

4. **Hardware durchreichen** (folgt mit der Businesslogik): USB-Mikrofon und
   Lautsprecher (ALSA/PulseAudio) müssen für Audio-Capture/TTS in den
   Backend-Container gereicht werden.

---

## Troubleshooting

**`Failed building wheel for pydantic-core` beim Backend-Setup**
Tritt mit **Python 3.14** auf — dafür existiert noch kein vorgebautes Wheel, und
pip versucht einen Rust-Source-Build. Lösung: venv mit **Python 3.11 oder 3.12**
anlegen (`python3.11 -m venv .venv`). Das Docker-Image nutzt `python:3.12-slim`
und ist nicht betroffen.

**Frontend zeigt dauerhaft den Idle-Screen**
Das Backend ist nicht erreichbar. Health prüfen (`curl localhost:8000/health`),
`VITE_WS_URL` kontrollieren. Der Client reconnectet automatisch, sobald das
Backend antwortet.

**WebSocket verbindet im Docker-Setup nicht**
Im Compose-Setup läuft der WS über den Nginx-Proxy des Frontends (`/ws`), nicht
direkt auf Port 8000. Frontend über <http://localhost:8080> öffnen.

**Bundle-Warnung „chunks larger than 500 kB“ beim Build**
Erwartet — Three.js ist groß. Für ein Skelett unkritisch; später per
Code-Splitting / `manualChunks` optimierbar.

---

## Roadmap

**Beta – erledigt:**

- [x] Audio-Capture im Browser (getUserMedia) + echter Mikrofon-Visualizer
- [x] Lokale Spracherkennung (whisper.cpp) über `POST /voice/stt`
- [x] Hermes-Agent als OpenAI-kompatibler Backend-Server (`AgentPort`, SSE-Streaming, Tool-Events)
- [x] Lokale Sprachausgabe (piper) + Visualizer aus TTS-Wiedergabe
- [x] Vollständige Zustands-Orchestrierung (listening → thinking → speaking → idle)
- [x] Widgets request-basiert (Open-Meteo live, Spotify-OAuth-Scaffold)
- [x] Chat-Widget mit Verlauf + wortweiser Rede-Animation
- [x] Hintergrundbild-Slideshow aus einem Ordner (Crossfade/Ken-Burns)

**Als Nächstes:**

- [ ] Wakeword-Erkennung (hands-free statt Push-to-talk)
- [ ] Streaming-TTS satzweise (geringere Latenz bis zum ersten Ton)
- [ ] Telegram-Kanal über Hermes aktivieren
- [ ] HTTPS/sichere Origins für LAN-Mikrofonzugriff

---

## Lizenz

Privates Projekt. Lizenz nach Bedarf ergänzen.
