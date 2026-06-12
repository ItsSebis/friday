/**
 * Application: Globaler UI-State (Zustand-Store).
 *
 * Single Source of Truth des Frontends. Die Präsentationsschicht liest hier und
 * rendert; eingehende Server-Nachrichten werden über `applyServerMessage` in den
 * Store übersetzt. Keine UI-Imports — reiner Zustand + Reducer-artige Aktionen.
 */
import { create } from 'zustand';
import { FridayState, isFridayState } from '@domain/states';
import {
  MessageType,
  type AudioSpeakPayload,
  type DashboardUpdatePayload,
  type Envelope,
  type ServerMessage,
  type ToolEventPayload,
} from '@domain/messages';

interface DashboardState {
  clock: string | null;
  weather: DashboardUpdatePayload['weather'] | null;
  spotify: DashboardUpdatePayload['spotify'] | null;
}

/** Ein Eintrag im Gesprächsverlauf (für das Chat-Widget). */
export interface ConversationEntry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

/** Maximale Länge des im Speicher gehaltenen Verlaufs. */
const MAX_CONVERSATION = 20;

interface FridayStore {
  // ── Zustand ──────────────────────────────────────────────────────
  /** Aktueller Betriebszustand (vom Backend gesetzt). */
  state: FridayState;
  /** Ob die WebSocket-Verbindung steht. */
  connected: boolean;
  /** Geglättete Audio-Amplitude 0..1 für den Visualizer. */
  audioLevel: number;
  /** Zuletzt erkannter Nutzertext. */
  transcript: string;
  /** Aktuell akkumulierte Agenten-Antwort (live, vor Abschluss). */
  response: string;
  /** Abgeschlossener Gesprächsverlauf (Chat-Widget). */
  conversation: ConversationEntry[];
  /** Letztes Tool-Event (für Tool-Panels). */
  lastToolEvent: ToolEventPayload | null;
  /** Zuletzt empfangene Sprech-Aufforderung (vom useVoice-Hook abgespielt). */
  audioSpeak: AudioSpeakPayload | null;
  /** Idle-Dashboard-Daten. */
  dashboard: DashboardState;
  /** URLs der Hintergrundbilder für die Idle-Slideshow. */
  images: string[];
  /** Letzte Fehlermeldung. */
  error: string | null;

  // ── Aktionen ─────────────────────────────────────────────────────
  setConnected: (connected: boolean) => void;
  /** Setzt den Audio-Pegel direkt (lokale Mik-/Wiedergabe-Quelle). */
  setAudioLevel: (level: number) => void;
  /** Setzt die Liste der Hintergrundbild-URLs. */
  setImages: (images: string[]) => void;
  /** Übersetzt eine eingehende Server-Nachricht in State-Mutationen. */
  applyServerMessage: (message: ServerMessage) => void;

  /**
   * Sendet eine Client-Nachricht an das Backend. No-op, solange keine
   * WebSocket-Verbindung registriert ist (siehe `registerSender`). Erlaubt
   * jeder Komponente (z. B. Interrupt-Button, Dev-Konsole) das Senden, ohne den
   * WS-Client direkt zu kennen.
   */
  sendToServer: <T extends Record<string, unknown>>(message: Envelope<T>) => void;
  /** Registriert die aktive Sendefunktion (vom `useWebSocket`-Hook gesetzt). */
  registerSender: (fn: (<T extends Record<string, unknown>>(m: Envelope<T>) => void) | null) => void;
}

const initialDashboard: DashboardState = {
  clock: null,
  weather: null,
  spotify: null,
};

// Modul-lokaler Halter der aktiven Sendefunktion. Bewusst außerhalb des
// reaktiven State, damit das Registrieren keine Re-Renders auslöst.
let activeSender: ((m: Envelope) => void) | null = null;

// Fortlaufende ID für Konversationseinträge.
let convCounter = 0;

/** Hängt einen Eintrag an den Verlauf an (gekappt auf MAX_CONVERSATION). */
function appendConversation(
  list: ConversationEntry[],
  role: ConversationEntry['role'],
  text: string,
): ConversationEntry[] {
  return [...list, { id: ++convCounter, role, text }].slice(-MAX_CONVERSATION);
}

export const useFridayStore = create<FridayStore>((set) => ({
  state: FridayState.IDLE,
  connected: false,
  audioLevel: 0,
  transcript: '',
  response: '',
  conversation: [],
  lastToolEvent: null,
  audioSpeak: null,
  dashboard: initialDashboard,
  images: [],
  error: null,

  setConnected: (connected) => set({ connected }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setImages: (images) => set({ images }),

  sendToServer: (message) => activeSender?.(message as Envelope),
  registerSender: (fn) => {
    activeSender = fn as ((m: Envelope) => void) | null;
  },

  applyServerMessage: (message) =>
    set((prev) => {
      switch (message.type) {
        case MessageType.STATE_CHANGED: {
          const next = message.payload.state;
          if (!isFridayState(next)) return prev;
          // Bei jedem neuen Listening-Zyklus Transkript/Antwort zurücksetzen.
          return next === FridayState.LISTENING
            ? { state: next, transcript: '', response: '' }
            : { state: next };
        }
        case MessageType.AUDIO_LEVEL:
          return { audioLevel: message.payload.level };
        case MessageType.TRANSCRIPT:
          // Finaler Nutzertext → als User-Eintrag in den Verlauf.
          return message.payload.final
            ? {
                transcript: message.payload.text,
                conversation: appendConversation(
                  prev.conversation,
                  'user',
                  message.payload.text,
                ),
              }
            : { transcript: message.payload.text };
        case MessageType.RESPONSE:
          // Bei Abschluss die akkumulierte Antwort als Assistant-Eintrag sichern.
          if (message.payload.complete) {
            return prev.response
              ? {
                  conversation: appendConversation(
                    prev.conversation,
                    'assistant',
                    prev.response,
                  ),
                  response: '',
                }
              : prev;
          }
          return { response: prev.response + message.payload.text };
        case MessageType.TOOL_EVENT:
          return { lastToolEvent: message.payload };
        case MessageType.AUDIO_SPEAK:
          return { audioSpeak: message.payload };
        case MessageType.DASHBOARD_UPDATE:
          return {
            dashboard: {
              clock: message.payload.clock ?? prev.dashboard.clock,
              weather: message.payload.weather ?? prev.dashboard.weather,
              spotify: message.payload.spotify ?? prev.dashboard.spotify,
            },
          };
        case MessageType.ERROR:
          return { error: message.payload.message };
        default:
          return prev;
      }
    }),
}));
