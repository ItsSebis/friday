/**
 * Presentation/Screen: SpeakingScreen.
 *
 * Aktiv, während Friday antwortet. Zeigt den Audio-Visualizer (an die
 * TTS-Ausgabe gekoppelt) und die laufend akkumulierte Antwort als Text.
 */
import { motion } from 'framer-motion';
import { AudioVisualizer } from '@presentation/components/AudioVisualizer';
import { StatusIndicator } from '@presentation/components/StatusIndicator';
import { useFridayStore } from '@application/store/useFridayStore';
import { theme } from '@presentation/theme/theme';

export function SpeakingScreen() {
  const response = useFridayStore((s) => s.response);

  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      style={{ flexDirection: 'column', gap: 32 }}
    >
      <AudioVisualizer size={300} />

      <StatusIndicator label="Antwortet" color={theme.color.secondary} pulse={false} />

      {response && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            maxWidth: '72%',
            textAlign: 'center',
            fontSize: 24,
            lineHeight: 1.5,
            color: 'var(--color-text)',
          }}
        >
          {response}
        </motion.p>
      )}
    </motion.div>
  );
}
