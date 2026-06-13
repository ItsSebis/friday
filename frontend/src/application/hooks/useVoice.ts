/**
 * Application: Voice-Bridge (Aufnahme ↔ STT ↔ TTS).
 *
 * Verbindet die Audio-Infrastruktur mit Store und WebSocket:
 *  - Push-to-talk: Aufnahme starten/stoppen, WAV an `POST /voice/stt` senden.
 *  - Mikrofonpegel live in den Store (→ echter Visualizer).
 *  - Bei `audio.speak` das TTS-WAV abspielen, Pegel speisen, am Ende `speak.done`.
 *
 * Muss genau **einmal** gemountet werden (z. B. in `TalkOverlay`).
 */
import { useCallback, useEffect, useRef } from 'react';
import { AudioRecorder } from '@infrastructure/audio/AudioRecorder';
import { AudioPlayer } from '@infrastructure/audio/AudioPlayer';
import { apiUrl } from '@infrastructure/http/api';
import { useFridayStore } from '@application/store/useFridayStore';
import { clientMessage, MessageType } from '@domain/messages';

export function useVoice() {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const recordingRef = useRef(false);
  // Ref auf stopListening, damit der onSilence-Callback des Recorders die
  // aktuelle Funktion erreicht (ohne Reihenfolge-/Closure-Probleme).
  const stopListeningRef = useRef<(() => void) | null>(null);

  const send = useFridayStore((s) => s.sendToServer);
  const setAudioLevel = useFridayStore((s) => s.setAudioLevel);
  const audioSpeak = useFridayStore((s) => s.audioSpeak);

  const startListening = useCallback(async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;
    send(clientMessage(MessageType.LISTEN_START));
    // Auto-Stopp nach Redepause (Endpointing) – ohne erneutes Tippen.
    const recorder = new AudioRecorder({
      onLevel: setAudioLevel,
      onSilence: () => void stopListeningRef.current?.(),
    });
    recorderRef.current = recorder;
    try {
      await recorder.start();
    } catch (err) {
      console.error('Mikrofonzugriff fehlgeschlagen:', err);
      recordingRef.current = false;
      recorderRef.current = null;
      send(clientMessage(MessageType.LISTEN_CANCEL));
    }
  }, [send, setAudioLevel]);

  const stopListening = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setAudioLevel(0);
    if (!recorder) return;

    const wav = await recorder.stop();
    const form = new FormData();
    form.append('audio', wav, 'speech.wav');
    try {
      // Antwort (Transkript/Tools/Sprechen) läuft asynchron über den WebSocket.
      await fetch(apiUrl('/voice/stt'), { method: 'POST', body: form });
    } catch (err) {
      console.error('STT-Upload fehlgeschlagen:', err);
      send(clientMessage(MessageType.LISTEN_CANCEL));
    }
  }, [send, setAudioLevel]);

  // Aktuelle stopListening-Funktion für den Recorder-Callback bereithalten.
  stopListeningRef.current = stopListening;

  const toggleListening = useCallback(() => {
    if (recordingRef.current) void stopListening();
    else void startListening();
  }, [startListening, stopListening]);

  // TTS abspielen, sobald eine audio.speak-Nachricht eintrifft.
  useEffect(() => {
    if (!audioSpeak?.audio_url) return;
    const player = new AudioPlayer({
      onLevel: setAudioLevel,
      onEnded: () => {
        setAudioLevel(0);
        send(clientMessage(MessageType.SPEAK_DONE));
      },
    });
    playerRef.current = player;
    player.play(apiUrl(audioSpeak.audio_url)).catch((err) => {
      console.error('TTS-Wiedergabe fehlgeschlagen:', err);
      setAudioLevel(0);
      send(clientMessage(MessageType.SPEAK_DONE));
    });
    return () => {
      player.stop();
      playerRef.current = null;
    };
  }, [audioSpeak, send, setAudioLevel]);

  return { startListening, stopListening, toggleListening };
}
