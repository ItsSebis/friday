/**
 * Presentation/Component: SpotifyWidget.
 *
 * Zeigt den aktuellen Spotify-Status aus `dashboard.spotify`. Reines Rendern –
 * die Wiedergabedaten liefert das Backend (Hermes-Tool).
 */
import { useFridayStore } from '@application/store/useFridayStore';
import { Panel } from './Panel';

export function SpotifyWidget() {
  const spotify = useFridayStore((s) => s.dashboard.spotify);

  return (
    <Panel style={{ minWidth: 240 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: spotify?.albumArt
              ? `center / cover url(${spotify.albumArt})`
              : 'var(--color-background-elevated)',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <span style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--color-text-muted)' }}>
            {spotify?.isPlaying ? 'SPIELT' : 'SPOTIFY'}
          </span>
          <span style={{ fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {spotify?.track ?? '—'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {spotify?.artist ?? ''}
          </span>
        </div>
      </div>
    </Panel>
  );
}
