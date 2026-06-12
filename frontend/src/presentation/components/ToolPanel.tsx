/**
 * Presentation/Component: ToolPanel.
 *
 * Zeigt das zuletzt vom Agenten ausgelöste Tool-Event (z. B. „Wetter abrufen“).
 * Erscheint kontextuell während der Thinking-/Speaking-Phase und blendet sich
 * sanft ein/aus (AnimatePresence im jeweiligen Screen).
 */
import { useFridayStore } from '@application/store/useFridayStore';
import { theme } from '@presentation/theme/theme';
import { Panel } from './Panel';

const STATUS_COLOR: Record<string, string> = {
  started: theme.color.accent,
  succeeded: theme.color.secondary,
  failed: theme.color.danger,
};

export function ToolPanel() {
  const event = useFridayStore((s) => s.lastToolEvent);
  if (!event) return null;

  return (
    <Panel style={{ minWidth: 220 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--color-text-muted)' }}>
          TOOL
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: STATUS_COLOR[event.status] ?? theme.color.textMuted,
              boxShadow: `0 0 10px ${STATUS_COLOR[event.status] ?? 'transparent'}`,
            }}
          />
          <span style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }}>{event.tool}</span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{event.status}</span>
      </div>
    </Panel>
  );
}
