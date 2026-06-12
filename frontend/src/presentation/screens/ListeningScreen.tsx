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
import { theme } from '@presentation/theme/theme';

export function ListeningScreen() {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      // Inhalt in die untere Hälfte; der Chat-Verlauf liegt darüber.
      style={{ flexDirection: 'column', gap: 28, justifyContent: 'flex-end', paddingBottom: '8vh' }}
    >
      <AudioVisualizer size={300} />
      <StatusIndicator label="Höre zu" color={theme.color.accent} pulse />
    </motion.div>
  );
}
