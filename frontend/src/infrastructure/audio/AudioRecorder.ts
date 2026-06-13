/**
 * Infrastructure: Mikrofon-Recorder (Web Audio API) mit Stille-Endpointing.
 *
 * Nimmt über `getUserMedia` auf, erfasst rohe PCM-Samples und kodiert beim Stopp
 * ein **16-kHz-Mono-WAV** (whisper-/Cloud-kompatibel). Liefert live den
 * Mikrofonpegel (RMS, 0..1) für den Visualizer.
 *
 * **Endpointing:** Erkennt anhand des Pegels Sprache und stoppt automatisch nach
 * einer Redepause (`onSilence`). Zusätzlich: Abbruch, wenn nie gesprochen wird
 * (`initialTimeout`), und ein hartes Maximum (`maxDuration`).
 *
 * Reine Transportschicht: kein React, kein Store.
 */
export interface AudioRecorderOptions {
  /** Mikrofonpegel (0..1), ~je Audio-Block. */
  onLevel?: (level: number) => void;
  /** Wird einmalig gefeuert, wenn die Aufnahme automatisch enden soll. */
  onSilence?: () => void;
  sampleRate?: number;
  /** Pegelschwelle, ab der „Sprache" gilt. */
  threshold?: number;
  /** Stille-Dauer nach Sprache bis zum Auto-Stopp (ms). */
  silenceMs?: number;
  /** Abbruch, falls bis dahin gar nicht gesprochen wurde (ms). */
  initialTimeoutMs?: number;
  /** Hartes Maximum der Aufnahmedauer (ms). */
  maxDurationMs?: number;
}

export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];

  private readonly sampleRate: number;
  private readonly threshold: number;
  private readonly silenceMs: number;
  private readonly initialTimeoutMs: number;
  private readonly maxDurationMs: number;

  private startedAt = 0;
  private lastVoiceAt = 0;
  private hasSpoken = false;
  private ended = false;

  constructor(private readonly options: AudioRecorderOptions = {}) {
    this.sampleRate = options.sampleRate ?? 16_000;
    this.threshold = options.threshold ?? 0.02;
    this.silenceMs = options.silenceMs ?? 1200;
    this.initialTimeoutMs = options.initialTimeoutMs ?? 6000;
    this.maxDurationMs = options.maxDurationMs ?? 15_000;
  }

  /** Fordert Mikrofonzugriff an und beginnt aufzuzeichnen. */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];
    this.startedAt = performance.now();
    this.lastVoiceAt = this.startedAt;
    this.hasSpoken = false;
    this.ended = false;

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));

      // Pegel (RMS) für Visualizer + Endpointing.
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      this.options.onLevel?.(Math.min(1, rms * 4));

      this.evaluateEndpoint(rms);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
  }

  /** Entscheidet anhand des Pegels, ob die Aufnahme enden soll. */
  private evaluateEndpoint(rms: number): void {
    if (this.ended) return;
    const now = performance.now();

    if (rms > this.threshold) {
      this.hasSpoken = true;
      this.lastVoiceAt = now;
    }

    const silenceAfterSpeech = this.hasSpoken && now - this.lastVoiceAt > this.silenceMs;
    const noSpeechTimeout = !this.hasSpoken && now - this.startedAt > this.initialTimeoutMs;
    const tooLong = now - this.startedAt > this.maxDurationMs;

    if (silenceAfterSpeech || noSpeechTimeout || tooLong) {
      this.ended = true;
      this.options.onSilence?.();
    }
  }

  /** Stoppt die Aufnahme und gibt sie als WAV-Blob zurück. */
  async stop(): Promise<Blob> {
    this.ended = true;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    const rate = this.ctx?.sampleRate ?? this.sampleRate;
    await this.ctx?.close();
    this.ctx = null;

    return this.encodeWav(this.mergeChunks(), rate);
  }

  private mergeChunks(): Float32Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    this.chunks = [];
    return merged;
  }

  /** Kodiert Float32-Samples als 16-bit-PCM-WAV. */
  private encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }
}
