/**
 * Presentation/Component: Clock.
 *
 * Große, dezente Uhr für den Idle-Screen. Tickt lokal im Sekundentakt; das
 * Backend kann optional über `dashboard.clock` einen Wert vorgeben (z. B. zur
 * Synchronisation), der dann bevorzugt angezeigt wird.
 */
import { useEffect, useState } from 'react';
import { useFridayStore } from '@application/store/useFridayStore';

function formatNow(): string {
  return new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Clock() {
  const backendClock = useFridayStore((s) => s.dashboard.clock);
  const [local, setLocal] = useState(formatNow);

  useEffect(() => {
    const id = setInterval(() => setLocal(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const display = backendClock ?? local;

  return (
    <time
      style={{
        fontSize: 'clamp(64px, 14vw, 160px)',
        fontWeight: 200,
        letterSpacing: '0.02em',
        color: 'var(--color-text)',
        textShadow: 'var(--glow-accent)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {display}
    </time>
  );
}
