/**
 * Plain PCM handling for a recorded take: mix to mono, cut to the kept range,
 * and write a WAV for the waveform to play. The take is always decoded to PCM
 * first — Chrome's MediaRecorder WebM carries no duration, so the browser's
 * own file cannot be scrubbed reliably (see process/AUDIO_CLIP_RECORDING.md).
 */

/** A mono take: samples in [-1, 1] at `sampleRate`. */
export interface MonoTake {
  samples: Float32Array;
  sampleRate: number;
}

/** Average every channel into one. */
export function mixToMono(channels: Float32Array[], length: number): Float32Array {
  const out = new Float32Array(length);
  if (channels.length === 0) return out;
  for (const data of channels) {
    for (let i = 0; i < length; i++) out[i] += data[i] / channels.length;
  }
  return out;
}

/** The decoded buffer as a mono take. */
export function monoTake(audio: AudioBuffer): MonoTake {
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
  return { samples: mixToMono(channels, audio.length), sampleRate: audio.sampleRate };
}

/** Seconds of audio in a take. */
export function takeDuration(take: MonoTake): number {
  return take.samples.length / take.sampleRate;
}

/** The take between `begin` and `end` seconds, clamped to the take. */
export function cropTake(take: MonoTake, begin: number, end: number): MonoTake {
  const first = Math.max(0, Math.min(take.samples.length, Math.round(begin * take.sampleRate)));
  const last = Math.max(first, Math.min(take.samples.length, Math.round(end * take.sampleRate)));
  return { samples: take.samples.slice(first, last), sampleRate: take.sampleRate };
}

/** A 16-bit mono WAV of the take. */
export function encodeWav(take: MonoTake): ArrayBuffer {
  const { samples, sampleRate } = take;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** `recording-2026-10-06-1432.mp3`, from the local time the take was kept. */
export function recordingFilename(date: Date, extension = 'mp3'): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `recording-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.${extension}`;
}
