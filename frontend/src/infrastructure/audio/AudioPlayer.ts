/**
 * Infrastructure: TTS-Wiedergabe (Web Audio API).
 *
 * Spielt ein WAV von einer URL ab und liefert dabei live den Ausgabepegel
 * (RMS, 0..1) für den Speaking-Visualizer. Meldet das Ende der Wiedergabe.
 *
 * Reine Transportschicht: kein React, kein Store.
 */
export interface AudioPlayerOptions {
  onLevel?: (level: number) => void;
  onEnded?: () => void;
}

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private raf = 0;

  constructor(private readonly options: AudioPlayerOptions = {}) {}

  /** Spielt das Audio unter `url` ab. */
  async play(url: string): Promise<void> {
    this.stop();
    this.ctx = new AudioContext();
    this.audioEl = new Audio(url);
    this.audioEl.crossOrigin = 'anonymous';

    const sourceNode = this.ctx.createMediaElementSource(this.audioEl);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    sourceNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.audioEl.addEventListener('ended', () => {
      this.stop();
      this.options.onEnded?.();
    });

    await this.audioEl.play();
    this.pump();
  }

  /** Stoppt die Wiedergabe und räumt auf. */
  stop(): void {
    cancelAnimationFrame(this.raf);
    this.audioEl?.pause();
    this.audioEl = null;
    this.analyser = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Liest fortlaufend den Pegel aus dem Analyser. */
  private pump = (): void => {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    this.options.onLevel?.(Math.min(1, rms * 2.5));
    this.raf = requestAnimationFrame(this.pump);
  };
}
