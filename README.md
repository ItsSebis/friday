# Friday

Ein physischer KI-Bilderrahmen im Stil von Iron Mans **FRIDAY**.

Friday läuft als Kiosk-Anwendung auf einem Raspberry Pi 5 und kombiniert einen
ambienten Bilderrahmenmodus mit einem sprachgesteuerten KI-Assistenten. Die
Sprachlogik, das Gedächtnis und die Tool-Integration übernimmt der **Hermes
Agent**; das Frontend ist eine reine Präsentationsschicht.

> **Status:** Architektur- und UI-Grundgerüst. Es ist bewusst **keine
> Businesslogik** implementiert — die Komponenten definieren Verträge, Layer und
> die visuelle Grundstruktur. Stubs sind mit `TODO(Businesslogik)` markiert.

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

**Hermes Agent (Backend)** — Agentenlogik / Orchestrierung, Memory, Tool Calling,
Telegram-Anbindung, OpenRouter-Integration (LLM).

**Frontend (Kiosk)** — Bilderrahmenmodus (Idle), Audio-Visualizer, Sprachstatus
(Listening / Thinking / Speaking), Tool-Panels, Dashboard (Uhrzeit, Wetter,
Spotify).

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
| `OPENROUTER_API_KEY`      | API-Key für OpenRouter (LLM)                   |
| `OPENROUTER_MODEL`        | Default-Modell, z. B. `anthropic/claude-opus-4-8` |
| `TELEGRAM_BOT_TOKEN`      | Token des Telegram-Bots (Hermes-Tool)          |
| `VITE_WS_URL`             | WebSocket-URL für das Frontend                 |

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
`tool.event`, `dashboard.update`, `error`.

**Client → Server:** `client.hello` (Handshake), `ui.interrupt` (Abbruch durch
Nutzer).

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

Das aktuelle Grundgerüst enthält **keine Businesslogik**. Als Nächstes:

- [ ] Wakeword-Erkennung + Audio-Capture (USB-Mikrofon → STT)
- [ ] Hermes-Agentenlogik, Memory & Tool Calling verdrahten
- [ ] OpenRouter-Streaming an `AgentPort` anbinden
- [ ] TTS-Ausgabe + Kopplung des Visualizers an reale Audio-Amplituden (FFT)
- [ ] Dashboard-Datenquellen (Wetter, Spotify) als Hermes-Tools
- [ ] Bildrotation im Idle-Modus mit echten Bildquellen
- [ ] Telegram-Integration aktivieren

---

## Lizenz

Privates Projekt. Lizenz nach Bedarf ergänzen.
