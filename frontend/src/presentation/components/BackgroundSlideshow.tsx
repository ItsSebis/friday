/**
 * Presentation/Component: BackgroundSlideshow.
 *
 * Zeigt die Hintergrundbilder (aus dem Store, befüllt per Polling von
 * `/widgets/images`) im Vollbild und cyclet sie mit sanftem Crossfade und
 * langsamem Ken-Burns-Zoom. Fehlen Bilder, rendert es einen dezenten Verlauf
 * als Fallback.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFridayStore } from '@application/store/useFridayStore';

/** Anzeigedauer pro Bild. */
const SLIDE_MS = 12_000;

export function BackgroundSlideshow() {
  const images = useFridayStore((s) => s.images);
  const [index, setIndex] = useState(0);

  // Index weiterzählen; bei Listenänderung in den gültigen Bereich klemmen.
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [images.length]);

  useEffect(() => {
    if (index >= images.length) setIndex(0);
  }, [images.length, index]);

  const current = images[index];

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#04070d' }}>
      {/* Fallback-Verlauf, falls (noch) keine Bilder vorhanden sind. */}
      {!current && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(160deg, #060b14 0%, #04070d 55%, #0a1018 100%)',
          }}
        />
      )}

      <AnimatePresence>
        {current && (
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1.12 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 2.2, ease: 'easeInOut' },
              scale: { duration: SLIDE_MS / 1000 + 2, ease: 'linear' }, // langsamer Zoom
            }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${current})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              willChange: 'transform, opacity',
            }}
          />
        )}
      </AnimatePresence>

      {/* Abdunkelung, damit Uhr/Widgets lesbar bleiben. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(4,7,13,0.25), rgba(4,7,13,0.78) 95%)',
        }}
      />
    </div>
  );
}
