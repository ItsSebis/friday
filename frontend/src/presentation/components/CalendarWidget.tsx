/**
 * Presentation/Component: CalendarWidget.
 *
 * Zeigt die nächsten 5 Ereignisse aus dem Kalender. Wird über REST-Polling
 * aktualisiert und ist komplett vom Agenten/WebSocket entkoppelt.
 * Positioniert in der oberen linken Ecke, angenehm breit.
 */
import { useFridayStore } from '@application/store/useFridayStore';
import { Panel } from './Panel';

export function CalendarWidget() {
  // Selektor gibt undefined zurück, wenn kein Kalender da ist (stabile Referenz)
  const calendarEvents = useFridayStore((s) => s.dashboard.calendar?.events);
  // Fallback erst hier in der Komponente anwenden
  const events = calendarEvents ?? [];

  if (!events || events.length === 0) {
    return (
      <Panel style={{ 
        position: 'absolute', 
        top: 16, 
        left: 16, 
        width: 320, 
        zIndex: 50 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            KALENDER
          </span>
          <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Keine anstehenden Termine</span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel style={{ 
      position: 'absolute', 
      top: 16, 
      left: 16, 
      width: 320, 
      zIndex: 50 
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          NÄCHSTE TERMINE
        </span>
        {events.map((ev, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: idx < events.length - 1 ? 12 : 0, borderBottom: idx < events.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {ev.start}
              </span>
              <span style={{ 
                fontSize: 10, 
                color: 'var(--color-text-muted)', 
                textTransform: 'uppercase', 
                fontWeight: 600,
                background: 'var(--color-bg-subtle)',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {ev.calendar}
              </span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3 }}>{ev.summary}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
