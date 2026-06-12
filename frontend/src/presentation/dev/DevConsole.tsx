/**
 * Presentation/Dev: Interaktive Dev-Konsole (Terminal-Overlay).
 *
 * NUR für die Entwicklung — wird über `import.meta.env.DEV`-Guards (App.tsx)
 * nicht in den Produktions-Build aufgenommen.
 *
 * Bedienung:
 *  - Taste «`» (Backtick) blendet die Konsole ein/aus, «Esc» schließt sie.
 *  - Befehle eintippen + Enter; «help» listet alles, ↑/↓ blättert durch den Verlauf.
 *
 * Die Konsole steuert ausschließlich den Store / den WebSocket über das
 * offizielle Protokoll — sie umgeht keine Geschäftslogik, sondern simuliert die
 * Nachrichten, die das Backend später selbst sendet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFridayStore } from '@application/store/useFridayStore';
import { API_BASE } from '@infrastructure/http/api';
import { MessageType, type ServerMessage } from '@domain/messages';
import { theme } from '@presentation/theme/theme';
import { runCommandLine, type DevCommandContext } from './commands';

const INTRO = ['Friday Dev-Konsole · "help" für Befehle · « ` » zum Schließen'];

export function DevConsole() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>(INTRO);
  const [input, setInput] = useState('');

  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live-Anzeige im Header.
  const state = useFridayStore((s) => s.state);
  const connected = useFridayStore((s) => s.connected);

  const log = useCallback((line: string) => {
    setLines((prev) => [...prev, line].slice(-200));
  }, []);

  const audioSim = useCallback((on: boolean) => {
    if (simRef.current) {
      clearInterval(simRef.current);
      simRef.current = null;
    }
    if (on) {
      let t = 0;
      simRef.current = setInterval(() => {
        t += 0.12;
        const level = (Math.sin(t) * 0.5 + 0.5) * 0.85 + 0.1;
        useFridayStore
          .getState()
          .applyServerMessage({ type: MessageType.AUDIO_LEVEL, payload: { level } } as ServerMessage);
      }, 60);
    }
  }, []);

  // Kontext, den jeder Befehl erhält.
  const apiBase = API_BASE;
  const ctx: DevCommandContext = useMemo(
    () => ({
      log,
      apiBase,
      inject: (m) => useFridayStore.getState().applyServerMessage(m),
      send: (m) => useFridayStore.getState().sendToServer(m),
      snapshot: () => {
        const s = useFridayStore.getState();
        return { state: s.state, connected: s.connected, audioLevel: s.audioLevel };
      },
      audioSim,
    }),
    [log, apiBase, audioSim],
  );

  // Hotkey: « ` » togglet, « Esc » schließt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Sim beim Unmount stoppen.
  useEffect(() => () => audioSim(false), [audioSim]);

  // Fokus + Autoscroll.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, open]);

  const submit = useCallback(async () => {
    const line = input;
    if (!line.trim()) return;
    log(`› ${line}`);
    historyRef.current.push(line);
    histIdxRef.current = historyRef.current.length;
    setInput('');
    await runCommandLine(line, ctx);
  }, [input, ctx, log]);

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      histIdxRef.current = Math.max(0, histIdxRef.current - 1);
      setInput(historyRef.current[histIdxRef.current] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histIdxRef.current = Math.min(historyRef.current.length, histIdxRef.current + 1);
      setInput(historyRef.current[histIdxRef.current] ?? '');
    }
  };

  // Geschlossen: dezenter Hinweis-Badge.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 12,
          zIndex: 9999,
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: 'var(--radius-pill)',
          border: `1px solid ${theme.color.panelBorder}`,
          background: 'rgba(4,7,13,0.6)',
          color: theme.color.textMuted,
          font: `11px ${theme.font.mono}`,
          letterSpacing: '0.1em',
          opacity: 0.5,
        }}
      >
        ` DEV
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '42vh',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(4,7,13,0.94)',
        borderTop: `1px solid ${theme.color.accent}`,
        boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        font: `13px ${theme.font.mono}`,
        color: theme.color.text,
        // Kiosk-Globals lokal überschreiben:
        cursor: 'auto',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 14px',
          borderBottom: `1px solid ${theme.color.panelBorder}`,
          color: theme.color.textMuted,
          letterSpacing: '0.08em',
        }}
      >
        <strong style={{ color: theme.color.accent }}>FRIDAY · DEV</strong>
        <span>state: {state}</span>
        <span style={{ color: connected ? theme.color.secondary : theme.color.danger }}>
          {connected ? '● ws verbunden' : '○ ws getrennt'}
        </span>
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>« ` » schließen</span>
      </div>

      {/* Scrollback */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', lineHeight: 1.5 }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              whiteSpace: 'pre-wrap',
              color: l.startsWith('✗') ? theme.color.danger : l.startsWith('›') ? theme.color.accent : undefined,
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Eingabe */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: `1px solid ${theme.color.panelBorder}` }}>
        <span style={{ color: theme.color.accent }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKey}
          spellCheck={false}
          autoComplete="off"
          placeholder="Befehl … (help)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.color.text,
            font: `13px ${theme.font.mono}`,
            cursor: 'text',
          }}
        />
      </div>
    </div>
  );
}
