/**
 * Presentation/Screen: ListeningScreen.
 *
 * Aktiv nach Wakeword-Erkennung. Zeigt den kreisförmigen Audio-Visualizer
 * (GPU/Three.js) zentral, die Statusanzeige und – sobald vorhanden – das
 * live mitlaufende Transkript.
 */
import { motion } from 'framer-motion';
import { AudioVisualizer } from '@presentation/components/AudioVisualizer';
import { StatusIndicator } from '@presentation/components/StatusIndicator';
import { useFridayStore } from '@application/store/useFridayStore';
import { theme } from '@presentation/theme/theme';

export function ListeningScreen() {
  const transcript = useFridayStore((s) => s.transcript);

  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      style={{ flexDirection: 'column', gap: 32 }}
    >
      <AudioVisualizer size={360} />

      <StatusIndicator label="Höre zu" color={theme.color.accent} pulse />

      {transcript && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            maxWidth: '70%',
            textAlign: 'center',
            fontSize: 20,
            color: 'var(--color-text-muted)',
          }}
        >
          {transcript}
        </motion.p>
      )}
    </motion.div>
  );
}
