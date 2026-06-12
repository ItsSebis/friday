/**
 * Presentation/Screen: SpeakingScreen.
 *
 * Aktiv, während Friday antwortet. Zeigt den Audio-Visualizer (an die
 * TTS-Ausgabe gekoppelt) und die laufend akkumulierte Antwort als Text.
 */
import { motion } from 'framer-motion';
import { AudioVisualizer } from '@presentation/components/AudioVisualizer';
import { StatusIndicator } from '@presentation/components/StatusIndicator';
import { theme } from '@presentation/theme/theme';

export function SpeakingScreen() {
  // Der Antworttext (inkl. Rede-Animation) läuft im globalen Chat-Widget.
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      style={{ flexDirection: 'column', gap: 28, justifyContent: 'flex-end', paddingBottom: '8vh' }}
    >
      <AudioVisualizer size={280} />
      <StatusIndicator label="Antwortet" color={theme.color.secondary} pulse={false} />
    </motion.div>
  );
}
