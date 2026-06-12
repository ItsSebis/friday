/**
 * Infrastructure: Mikrofon-Recorder (Web Audio API).
 *
 * Nimmt über `getUserMedia` auf, erfasst rohe PCM-Samples und kodiert beim Stopp
 * ein **16-kHz-Mono-WAV** — genau das Format, das whisper.cpp erwartet (kein
 * serverseitiges Transcoding nötig). Liefert zusätzlich live den Mikrofonpegel
 * (RMS, 0..1) für den Audio-Visualizer.
 *
 * Reine Transportschicht: kein React, kein Store.
 */
export interface AudioRecorderOptions {
  /** Callback für den geglätteten Mikrofonpegel (0..1), ~60×/s. */
  onLevel?: (level: number) => void;
  /** Ziel-Abtastrate (whisper.cpp erwartet 16 kHz). */
  sampleRate?: number;
}

export class AudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private rafLevel = 0;
  private readonly sampleRate: number;

  constructor(private readonly options: AudioRecorderOptions = {}) {
    this.sampleRate = options.sampleRate ?? 16_000;
  }

  /** Fordert Mikrofonzugriff an und beginnt aufzuzeichnen. */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Chromium unterstützt das Erzwingen der Abtastrate am AudioContext.
    this.ctx = new AudioContext({ sampleRate: this.sampleRate });
    this.source = this.ctx.createMediaStreamSource(this.stream);

    // ScriptProcessor ist breit unterstützt; AudioWorklet wäre die moderne
    // Alternative, für das Grundgerüst genügt dies.
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.chunks = [];

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
      // Pegel (RMS) für den Visualizer.
      if (this.options.onLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        this.options.onLevel(Math.min(1, rms * 4)); // empirische Skalierung
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
  }

  /** Stoppt die Aufnahme und gibt die Aufnahme als WAV-Blob zurück. */
  async stop(): Promise<Blob> {
    cancelAnimationFrame(this.rafLevel);
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    const rate = this.ctx?.sampleRate ?? this.sampleRate;
    await this.ctx?.close();
    this.ctx = null;

    const samples = this.mergeChunks();
    return this.encodeWav(samples, rate);
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
    view.setUint32(16, 16, true); // PCM-Header-Größe
    view.setUint16(20, 1, true); // Audioformat PCM
    view.setUint16(22, 1, true); // Kanäle: mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byterate
    view.setUint16(32, 2, true); // Blockausrichtung
    view.setUint16(34, 16, true); // Bits pro Sample
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
