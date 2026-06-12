/**
 * Presentation/Component: WeatherWidget.
 *
 * Zeigt Wetterdaten aus dem `dashboard.weather`-State. Reines Rendern – die
 * Daten liefert das Backend (Hermes-Tool) über `dashboard.update`.
 */
import { useFridayStore } from '@application/store/useFridayStore';
import { Panel } from './Panel';

export function WeatherWidget() {
  const weather = useFridayStore((s) => s.dashboard.weather);

  return (
    <Panel style={{ minWidth: 180 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--color-text-muted)' }}>
          WETTER
        </span>
        {weather ? (
          <>
            <span style={{ fontSize: 36, fontWeight: 300 }}>
              {weather.temperatureC ?? '—'}°
            </span>
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              {weather.condition ?? '—'}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>—</span>
        )}
      </div>
    </Panel>
  );
}
