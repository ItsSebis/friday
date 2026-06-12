/**
 * Presentation/Component: Kreisförmiger Audio-Visualizer (GPU via Three.js).
 *
 * Rendert einen pulsierenden Ring aus radial angeordneten Balken, deren Skalierung
 * von `level` (0..1, aus dem Store) getrieben wird. Läuft komplett auf der GPU
 * über `@react-three/fiber`; die Animation erfolgt im Render-Loop (`useFrame`),
 * nicht über React-Re-Renders → flüssig auf dem Raspberry Pi.
 *
 * Grundgerüst: Geometrie + Reaktion auf `level` sind angelegt; die Anbindung an
 * echte FFT-Frequenzbänder folgt mit der Businesslogik.
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFridayStore } from '@application/store/useFridayStore';
import { theme } from '@presentation/theme/theme';

interface AudioVisualizerProps {
  /** Pixelgröße des quadratischen Canvas. */
  size?: number;
  /** Anzahl der radialen Balken. */
  bars?: number;
}

/** Innenleben: die animierten Balken im R3F-Scene-Graph. */
function VisualizerRing({ bars }: { bars: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const accent = useMemo(() => new THREE.Color(theme.color.accent), []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // `level` ohne Re-Render lesen (Snapshot aus dem Store).
    const level = useFridayStore.getState().audioLevel;

    // Langsame Grunddrehung als ambiente Bewegung.
    group.rotation.z += delta * 0.15;

    // Jeden Balken anhand des Pegels skalieren (mit Phasenversatz pro Index).
    group.children.forEach((child, i) => {
      const phase = (i / bars) * Math.PI * 2;
      const target = 1 + level * (1.5 + 0.6 * Math.sin(phase * 3));
      // Sanftes Annähern (Lerp) für weiche Bewegung.
      child.scale.y += (target - child.scale.y) * Math.min(1, delta * 8);
    });
  });

  const items = useMemo(() => Array.from({ length: bars }, (_, i) => i), [bars]);
  const radius = 2.2;

  return (
    <group ref={groupRef}>
      {items.map((i) => {
        const angle = (i / bars) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <planeGeometry args={[0.08, 0.6]} />
            <meshBasicMaterial color={accent} transparent opacity={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

export function AudioVisualizer({ size = 320, bars = 64 }: AudioVisualizerProps) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <VisualizerRing bars={bars} />
      </Canvas>
    </div>
  );
}
