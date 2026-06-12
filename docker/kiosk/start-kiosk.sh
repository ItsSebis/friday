#!/usr/bin/env bash
# Friday – Kiosk-Autostart für den Raspberry Pi 5.
#
# Startet Chromium im Vollbild-Kiosk-Modus und zeigt das Friday-Frontend.
# Erwartet, dass die Container (docker compose up -d) bereits laufen.
#
# Einbindung (Wayland/labwc oder X11), z. B. in der Autostart-Konfiguration:
#   bash /home/pi/friday/docker/kiosk/start-kiosk.sh
set -euo pipefail

FRIDAY_URL="${FRIDAY_URL:-http://localhost:8080}"

# Bildschirmschoner/Energieverwaltung deaktivieren (X11).
if command -v xset >/dev/null 2>&1; then
  xset s off
  xset -dpms
  xset s noblank
fi

# Cursor ausblenden, falls verfügbar.
command -v unclutter >/dev/null 2>&1 && unclutter -idle 0 &

# Chromium im Kiosk-Modus.
CHROME_BIN="$(command -v chromium-browser || command -v chromium || echo chromium)"

exec "$CHROME_BIN" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --ozone-platform-hint=auto \
  --app="$FRIDAY_URL"
