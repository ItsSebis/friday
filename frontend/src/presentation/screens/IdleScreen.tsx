/**
 * Presentation/Screen: IdleScreen (Bilderrahmenmodus).
 *
 * Standardzustand: ambiente Bildrotation als Hintergrund, darüber das Dashboard
 * mit Uhr (zentral) sowie Wetter- und Spotify-Widgets. Die Bildquellen liefert
 * später das Backend; hier ist der Slot als dezenter Verlauf angelegt.
 */
import { motion } from 'framer-motion';
import { Clock } from '@presentation/components/Clock';
import { WeatherWidget } from '@presentation/components/WeatherWidget';
import { SpotifyWidget } from '@presentation/components/SpotifyWidget';
import { BackgroundSlideshow } from '@presentation/components/BackgroundSlideshow';
import { theme } from '@presentation/theme/theme';

export function IdleScreen() {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.slow, ease: theme.motion.ease }}
      style={{ flexDirection: 'column' }}
    >
      {/* Rotierende Hintergrundbilder (aus dem Bilderordner). */}
      <BackgroundSlideshow />

      {/* Zentrale Uhr */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Clock />
      </div>

      {/* Dashboard-Widgets unten */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: 48,
          right: 48,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          zIndex: 1,
        }}
      >
        <WeatherWidget />
        <SpotifyWidget />
      </div>
    </motion.div>
  );
}
