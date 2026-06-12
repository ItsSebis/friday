/**
 * Infrastructure: Typisierter WebSocket-Client.
 *
 * Kapselt den nativen `WebSocket` inkl. automatischem Reconnect mit
 * exponentiellem Backoff. Übersetzt rohe Frames in typisierte
 * `ServerMessage`-Objekte und reicht sie über Callbacks nach oben. Kennt weder
 * React noch den Store — reine Transportschicht.
 */
import type { Envelope, ServerMessage } from '@domain/messages';

export interface WebSocketClientOptions {
  url: string;
  onMessage: (message: ServerMessage) => void;
  onStatusChange?: (connected: boolean) => void;
  /** Maximales Reconnect-Intervall in ms. */
  maxBackoffMs?: number;
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private backoffMs = 500;
  private readonly maxBackoffMs: number;
  private shouldRun = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: WebSocketClientOptions) {
    this.maxBackoffMs = options.maxBackoffMs ?? 10_000;
  }

  /** Startet die Verbindung und aktiviert Auto-Reconnect. */
  connect(): void {
    this.shouldRun = true;
    this.open();
  }

  /** Schließt die Verbindung und stoppt Reconnect-Versuche. */
  disconnect(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  /** Sendet eine typisierte Nachricht an den Server (no-op wenn getrennt). */
  send<T extends Record<string, unknown>>(message: Envelope<T>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private open(): void {
    this.socket = new WebSocket(this.options.url);

    this.socket.onopen = () => {
      this.backoffMs = 500; // Backoff zurücksetzen
      this.options.onStatusChange?.(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        this.options.onMessage(parsed);
      } catch {
        // Ungültige Frames stillschweigend verwerfen (robust gegen Müll).
      }
    };

    this.socket.onclose = () => {
      this.options.onStatusChange?.(false);
      if (this.shouldRun) this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // onclose folgt; dort wird reconnectet.
      this.socket?.close();
    };
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => this.open(), this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
  }
}
