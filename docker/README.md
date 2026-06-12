# Docker & Kiosk-Deployment

Setup für das Ausführen von Friday auf einem Raspberry Pi 5.

## Container starten

Vom Repo-Root:

```bash
cp .env.example .env          # Werte eintragen (OpenRouter, Telegram …)
docker compose up --build -d
```

Danach:

- Frontend: <http://localhost:8080>
- Backend-Health: <http://localhost:8000/health>

Nginx (Frontend) proxyt `/ws` und `/health|/meta` an das Backend — Frontend und
Backend teilen sich damit denselben Origin.

## Kiosk-Browser (Autostart)

`docker/kiosk/start-kiosk.sh` startet Chromium im Vollbild-Kiosk-Modus auf die
Frontend-URL. Skript ausführbar machen und in den Autostart der Desktop-Sitzung
hängen:

```bash
chmod +x docker/kiosk/start-kiosk.sh
```

Beispiel (X11, `~/.config/lxsession/LXDE-pi/autostart` oder systemd-User-Service):

```
@bash /home/pi/friday/docker/kiosk/start-kiosk.sh
```

Optional per Umgebungsvariable die URL überschreiben:

```bash
FRIDAY_URL=http://localhost:8080 bash docker/kiosk/start-kiosk.sh
```

## Hinweise zur Hardware (Pi 5)

- **Audio:** USB-Mikrofon und Lautsprecher werden vom Backend angesprochen
  (Audio-Capture/TTS folgen mit der Businesslogik); ggf. ALSA/PulseAudio-Geräte
  in den Backend-Container durchreichen.
- **Display:** Querformat oder gedreht — der Kiosk skaliert über die volle
  Viewport-Größe.
- **arm64:** Beide Images bauen nativ auf dem Pi; alternativ per `buildx`
  cross-bauen.
