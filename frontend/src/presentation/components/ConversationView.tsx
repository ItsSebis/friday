/**
 * Presentation/Component: ConversationView (Chat-Widget).
 *
 * Zeigt den Gesprächsverlauf als Bubbles — Nutzerfragen rechts, Friday-Antworten
 * links. Die gerade entstehende Antwort wird mit einer **wortweisen
 * Rede-Animation** eingeblendet (neue Wörter faden sanft ein, während die TTS
 * spricht). Liest ausschließlich aus dem Store.
 */
import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useFridayStore } from '@application/store/useFridayStore';
import { theme } from '@presentation/theme/theme';

/** Antworttext, der neu hinzukommende Wörter einzeln einblendet. */
function SpeechText({ text, animate }: { text: string; animate: boolean }) {
  const words = useMemo(() => text.split(/(\s+)/), [text]); // Whitespace erhalten
  if (!animate) return <>{text}</>;
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: theme.motion.ease }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

interface BubbleProps {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  speaking?: boolean;
}

function Bubble({ role, children, speaking = false }: BubbleProps) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '72%',
        padding: '12px 18px',
        borderRadius: 'var(--radius-lg)',
        borderBottomRightRadius: isUser ? '6px' : 'var(--radius-lg)',
        borderBottomLeftRadius: isUser ? 'var(--radius-lg)' : '6px',
        background: isUser ? 'rgba(54, 214, 255, 0.16)' : 'var(--color-panel)',
        border: `1px solid ${isUser ? theme.color.accentSoft : theme.color.panelBorder}`,
        boxShadow: speaking ? 'var(--glow-accent)' : 'none',
        color: 'var(--color-text)',
        fontSize: 20,
        lineHeight: 1.45,
        backdropFilter: 'blur(var(--blur-panel))',
      }}
    >
      {children}
    </motion.div>
  );
}

export function ConversationView() {
  const conversation = useFridayStore((s) => s.conversation);
  const response = useFridayStore((s) => s.response);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Immer ans Ende scrollen, wenn neuer Inhalt kommt.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversation, response]);

  return (
    <div
      ref={scrollRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: 'min(760px, 86vw)',
        maxHeight: '64vh',
        overflowY: 'auto',
        padding: '4px 4px 8px',
        // Sanftes Ausblenden am oberen Rand.
        maskImage: 'linear-gradient(to bottom, transparent, black 12%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12%)',
      }}
    >
      {conversation.map((entry) => (
        <Bubble key={entry.id} role={entry.role}>
          {entry.text}
        </Bubble>
      ))}

      {/* Laufende Antwort mit Rede-Animation. */}
      {response && (
        <Bubble role="assistant" speaking>
          <SpeechText text={response} animate />
        </Bubble>
      )}
    </div>
  );
}
