# Frontend-Architektur

Das Kiosk-Frontend folgt **Clean Architecture**. Importe zeigen nach innen;
React, Three.js und Framer Motion sind austauschbare Präsentationsdetails.

```
src/
├── domain/            # Verträge & Typen (framework-frei, spiegelt das Backend-Protokoll)
│   ├── states.ts          FridayState – Zustands-Enum
│   └── messages.ts        WebSocket-Protokoll (Envelope + Payload-Typen)
│
├── application/       # Zustandslogik & Orchestrierung
│   ├── store/
│   │   └── useFridayStore.ts   Zustand-Store: Single Source of Truth des UI-State
│   └── hooks/
│       └── useWebSocket.ts     Verbindet WebSocketClient ↔ Store (Effekt-Hook)
│
├── infrastructure/    # Adapter zu externen Systemen
│   └── websocket/
│       └── WebSocketClient.ts  Typisierter WS-Client mit Auto-Reconnect
│
└── presentation/      # UI – React-Komponenten (kennen nur Store + Domain-Typen)
    ├── theme/             Theme-Tokens + ThemeProvider (CSS-Variablen)
    ├── screens/           Ein Screen pro FridayState (Idle/Listening/Thinking/Speaking)
    ├── components/        Wiederverwendbare Bausteine (Panel, Visualizer, Widgets …)
    └── dev/               Dev-only: Konsole + Befehls-Registry (nur im DEV-Build, siehe README)
```

## Abhängigkeitsregel

- `domain` importiert nichts aus anderen Schichten.
- `application` darf `domain` + `infrastructure` (über Typen) nutzen.
- `presentation` liest ausschließlich aus dem `application/store` und aus
  `domain`-Typen — niemals direkt aus `infrastructure`.
- Pfad-Aliase (`@domain`, `@application`, …) erzwingen klare Importgrenzen.

## State-Fluss

```
Backend ──WS──► WebSocketClient ──► useWebSocket ──► useFridayStore ──► Screens/Components
                  (Transport)        (Bridge)         (Single Source)     (reines Rendern)
```

Die Komponenten sind **rein**: Sie lesen Zustand aus dem Store und rendern. Der
sichtbare Screen wird allein durch `state` im Store bestimmt (`<AppRouter>`),
animiert per Framer Motion (`AnimatePresence`).

## Designprinzipien

- **Dunkel & futuristisch**, FRIDAY-inspiriert; runde Elemente, transparente Panels.
- **GPU-beschleunigt**: Animationen nur über `transform`/`opacity`; der
  Audio-Visualizer rendert via Three.js (`@react-three/fiber`) auf der GPU.
- **Sanfte Übergänge** zwischen Screens via `AnimatePresence`.
- Alle visuellen Tokens (Farben, Radien, Glow) zentral in `presentation/theme`.
