/**
 * Presentation/Component: FrameView.
 *
 * Die **persistente** Grundoberfläche von Friday — immer sichtbar, unabhängig
 * vom Zustand: rotierende Hintergrundbilder, Uhr und Dashboard-Widgets. Der
 * Zustand wechselt NICHT mehr die ganze Oberfläche (siehe StatusOrb); lediglich
 * die zentrale Uhr tritt während eines Gesprächs dezent zurück, um Platz für das
 * Chat-Widget zu machen.
 */
import { motion } from 'framer-motion';
import { Clock } from '@presentation/components/Clock';
import { WeatherWidget } from '@presentation/components/WeatherWidget';
import { SpotifyWidget } from '@presentation/components/SpotifyWidget';
import { BackgroundSlideshow } from '@presentation/components/BackgroundSlideshow';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';
import { theme } from '@presentation/theme/theme';
import { CalendarWidget } from '@presentation/components/CalendarWidget';

export function FrameView() {
  const isIdle = useFridayStore((s) => s.state === FridayState.IDLE);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Rotierende Hintergrundbilder. */}
      <BackgroundSlideshow />

      {/* Zentrale Uhr – im Gespräch ausgeblendet. */}
      <motion.div
        animate={{ opacity: isIdle ? 1 : 0 }}
        transition={{ duration: theme.motion.slow, ease: theme.motion.ease }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Clock />
      </motion.div>

      {/* Dashboard-Widgets – immer sichtbar. */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 24,
        }}
      >
        <CalendarWidget />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 24,
        }}
      >
        <WeatherWidget />
        <SpotifyWidget />
      </div>
    </div>
  );
}
