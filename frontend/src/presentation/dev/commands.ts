/**
 * Presentation/Dev: Befehls-Registry der Dev-Konsole.
 *
 * NUR für die Entwicklung. Diese Datei wird über `import.meta.env.DEV`-Guards
 * nicht in den Produktions-Build aufgenommen (siehe App.tsx / DevConsole.tsx).
 *
 * Zwei Arten von Befehlen:
 *  - **lokal** (`inject`): schreibt direkt in den Store über exakt denselben
 *    Reducer wie echte Server-Nachrichten → funktioniert auch ohne Backend.
 *  - **Backend-Roundtrip** (`ws …`): ruft die Debug-Endpoints des Backends auf,
 *    das daraufhin per WebSocket broadcastet → echter End-to-End-Pfad.
 */
import { FridayState, isFridayState } from '@domain/states';
import { API_BASE, WS_URL } from '@infrastructure/http/api';
import {
  MessageType,
  clientMessage,
  type Envelope,
  type ServerMessage,
} from '@domain/messages';

/** Schnappschuss-Form des Stores (nur die hier benötigten Felder). */
export interface StoreSnapshot {
  state: FridayState;
  connected: boolean;
  audioLevel: number;
}

/** Laufzeit-Kontext, den die DevConsole jedem Befehl bereitstellt. */
export interface DevCommandContext {
  /** Zeile in die Konsolenausgabe schreiben. */
  log: (line: string) => void;
  /** HTTP-Basis-URL des Backends (aus VITE_WS_URL abgeleitet). */
  apiBase: string;
  /** Lokale Injektion: behandelt eine (Fake-)Server-Nachricht wie eine echte. */
  inject: (message: ServerMessage) => void;
  /** Client→Server-Nachricht über den WebSocket senden. */
  send: <T extends Record<string, unknown>>(message: Envelope<T>) => void;
  /** Aktuellen Store-Schnappschuss lesen. */
  snapshot: () => StoreSnapshot;
  /** Audio-Pegel-Simulation an/aus (Sinus-Welle in den Store). */
  audioSim: (on: boolean) => void;
}

export interface DevCommand {
  name: string;
  usage: string;
  desc: string;
  run: (args: string[], ctx: DevCommandContext) => void | Promise<void>;
}

/** Hilfskonstruktor für eine injizierte (Fake-)Server-Nachricht. */
function srv<T extends Record<string, unknown>>(type: MessageType, payload: T): ServerMessage {
  return { type, payload } as unknown as ServerMessage;
}

const STATES = Object.values(FridayState).join(' | ');

async function postDebug(ctx: DevCommandContext, path: string, body?: unknown): Promise<void> {
  try {
    const res = await fetch(`${ctx.apiBase}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    ctx.log(res.ok ? `→ 200 ${path}` : `→ ${res.status} ${path} (Backend im dev-Env?)`);
  } catch (err) {
    ctx.log(`✗ Backend nicht erreichbar: ${String(err)}`);
  }
}

export const COMMANDS: DevCommand[] = [
  {
    name: 'help',
    usage: 'help',
    desc: 'Diese Befehlsübersicht anzeigen',
    run: (_args, ctx) => {
      ctx.log('Befehle (lokal = ohne Backend):');
      for (const c of COMMANDS) ctx.log(`  ${c.usage.padEnd(28)} — ${c.desc}`);
    },
  },
  {
    name: 'status',
    usage: 'status',
    desc: 'Verbindungsstatus & aktueller Zustand',
    run: (_args, ctx) => {
      const s = ctx.snapshot();
      ctx.log(`state=${s.state}  connected=${s.connected}  audio=${s.audioLevel.toFixed(2)}`);
      ctx.log(`ws=${WS_URL}  (connected bezieht sich auf DIESE Backend-Verbindung)`);
      ctx.log(`api=${API_BASE}`);
    },
  },
  {
    name: 'diag',
    usage: 'diag',
    desc: 'Backend-Erreichbarkeit + Endpoints prüfen (zeigt Fehler)',
    run: async (_args, ctx) => {
      ctx.log(`WS_URL   = ${WS_URL}`);
      ctx.log(`API_BASE = ${API_BASE}`);
      for (const path of ['/health', '/widgets/weather', '/widgets/spotify']) {
        try {
          const res = await fetch(`${ctx.apiBase}${path}`);
          const body = (await res.text()).slice(0, 160);
          ctx.log(`${res.ok ? '✓' : '✗'} ${res.status} ${path} → ${body}`);
        } catch (err) {
          ctx.log(`✗ ${path} → nicht erreichbar: ${String(err)}`);
        }
      }
    },
  },
  {
    name: 'state',
    usage: 'state <name>',
    desc: `Zustand lokal setzen (${STATES})`,
    run: (args, ctx) => {
      const next = args[0];
      if (!isFridayState(next)) return ctx.log(`✗ Unbekannter Zustand. Erlaubt: ${STATES}`);
      ctx.inject(srv(MessageType.STATE_CHANGED, { state: next }));
      ctx.log(`state → ${next}`);
    },
  },
  {
    name: 'interrupt',
    usage: 'interrupt',
    desc: 'Echten ui.interrupt an das Backend senden',
    run: (_args, ctx) => {
      ctx.send(clientMessage(MessageType.UI_INTERRUPT));
      ctx.log('ui.interrupt gesendet');
    },
  },
  {
    name: 'say',
    usage: 'say <text…>',
    desc: 'Agenten-Turn OHNE Mikrofon/STT auslösen (testet Hermes isoliert)',
    run: async (args, ctx) => {
      const text = args.join(' ');
      if (!text) return ctx.log('✗ say <text>');
      await postDebug(ctx, '/debug/say', { text });
      ctx.log('→ Agenten-Turn ausgelöst; Antwort kommt über den WebSocket');
    },
  },
  {
    name: 'audio',
    usage: 'audio <0..1|sim|stop>',
    desc: 'Visualizer-Pegel setzen oder simulieren',
    run: (args, ctx) => {
      const a = args[0];
      if (a === 'sim') return ctx.audioSim(true), ctx.log('audio-sim an');
      if (a === 'stop') return ctx.audioSim(false), ctx.log('audio-sim aus');
      const level = Number(a);
      if (Number.isNaN(level)) return ctx.log('✗ Zahl 0..1, "sim" oder "stop"');
      ctx.inject(srv(MessageType.AUDIO_LEVEL, { level: Math.max(0, Math.min(1, level)) }));
      ctx.log(`audioLevel → ${level}`);
    },
  },
  {
    name: 'transcript',
    usage: 'transcript <text…>',
    desc: 'Erkannten Nutzertext setzen (Listening-Screen)',
    run: (args, ctx) => {
      ctx.inject(srv(MessageType.TRANSCRIPT, { text: args.join(' '), final: true }));
      ctx.log('transcript gesetzt');
    },
  },
  {
    name: 'response',
    usage: 'response <text…>',
    desc: 'Agenten-Antwort anhängen (Speaking-Screen)',
    run: (args, ctx) => {
      ctx.inject(srv(MessageType.RESPONSE, { text: args.join(' ') + ' ', complete: false }));
      ctx.log('response erweitert');
    },
  },
  {
    name: 'tool',
    usage: 'tool <name> <started|succeeded|failed>',
    desc: 'Tool-Event für die Tool-Panels auslösen',
    run: (args, ctx) => {
      const [tool, status = 'started'] = args;
      if (!tool) return ctx.log('✗ tool <name> <status>');
      ctx.inject(srv(MessageType.TOOL_EVENT, { tool, status, detail: {} }));
      ctx.log(`tool ${tool} → ${status}`);
    },
  },
  {
    name: 'weather',
    usage: 'weather <°C> <bedingung…>',
    desc: 'Wetter-Widget befüllen',
    run: (args, ctx) => {
      const temperatureC = Number(args[0]);
      const condition = args.slice(1).join(' ') || 'Klar';
      ctx.inject(srv(MessageType.DASHBOARD_UPDATE, { weather: { temperatureC, condition } }));
      ctx.log(`weather → ${temperatureC}° ${condition}`);
    },
  },
  {
    name: 'spotify',
    usage: 'spotify <track> | <artist>',
    desc: 'Spotify-Widget befüllen',
    run: (args, ctx) => {
      const [track = '', artist = ''] = args.join(' ').split('|').map((s) => s.trim());
      ctx.inject(
        srv(MessageType.DASHBOARD_UPDATE, { spotify: { track, artist, isPlaying: true } }),
      );
      ctx.log(`spotify → ${track} – ${artist}`);
    },
  },
  {
    name: 'dashboard',
    usage: 'dashboard',
    desc: 'Demo-Daten für Uhr, Wetter & Spotify einspielen',
    run: (_args, ctx) => {
      ctx.inject(
        srv(MessageType.DASHBOARD_UPDATE, {
          clock: '14:32',
          weather: { temperatureC: 21, condition: 'Teils bewölkt' },
          spotify: { track: 'Back In Black', artist: 'AC/DC', isPlaying: true },
        }),
      );
      ctx.log('dashboard demo-daten gesetzt');
    },
  },
  {
    name: 'error',
    usage: 'error <text…>',
    desc: 'Fehlermeldung in den Store setzen',
    run: (args, ctx) => {
      ctx.inject(srv(MessageType.ERROR, { message: args.join(' ') || 'Testfehler' }));
      ctx.log('error gesetzt');
    },
  },
  {
    name: 'reset',
    usage: 'reset',
    desc: 'Transkript/Antwort/Tool/Fehler leeren (zurück zu idle)',
    run: (_args, ctx) => {
      ctx.inject(srv(MessageType.STATE_CHANGED, { state: FridayState.LISTENING }));
      ctx.inject(srv(MessageType.STATE_CHANGED, { state: FridayState.IDLE }));
      ctx.audioSim(false);
      ctx.inject(srv(MessageType.AUDIO_LEVEL, { level: 0 }));
      ctx.log('reset');
    },
  },
  {
    name: 'ws',
    usage: 'ws <state|dashboard|tool|audio> …',
    desc: 'Über Backend-Debug-Endpoints broadcasten (End-to-End)',
    run: async (args, ctx) => {
      const [sub, ...rest] = args;
      switch (sub) {
        case 'state':
          if (!isFridayState(rest[0])) return ctx.log(`✗ ws state <${STATES}>`);
          return postDebug(ctx, `/debug/state/${rest[0]}`);
        case 'dashboard':
          return postDebug(ctx, '/debug/dashboard');
        case 'tool':
          return postDebug(ctx, `/debug/tool/${rest[0] ?? 'demo'}/${rest[1] ?? 'started'}`);
        case 'audio':
          return postDebug(ctx, `/debug/audio/${rest[0] ?? '0.5'}`);
        default:
          return ctx.log('✗ ws <state|dashboard|tool|audio>');
      }
    },
  },
];

/** Parst eine Eingabezeile, führt den Befehl aus und meldet Unbekanntes. */
export async function runCommandLine(line: string, ctx: DevCommandContext): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;
  const [name, ...args] = trimmed.split(/\s+/);
  const cmd = COMMANDS.find((c) => c.name === name);
  if (!cmd) return ctx.log(`✗ Unbekannter Befehl: ${name} — "help" für Übersicht`);
  await cmd.run(args, ctx);
}
