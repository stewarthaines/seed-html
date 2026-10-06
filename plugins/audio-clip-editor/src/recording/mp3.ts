/**
 * Constant-bit-rate mp3 for recorded clips. The audio-clips player seeks
 * reliably only in CBR files (extensions/audio-clips/clip-player.js), and
 * browsers cannot record mp3 at all, so the plugin encodes the kept PCM itself
 * with LAME compiled to WebAssembly (wasm-media-encoders). The .wasm is a
 * separate file the caller loads, never inlined into plugin.html, so the
 * LGPL-licensed LAME can be replaced (THIRD_PARTY_NOTICES.txt).
 */
import { createEncoder } from 'wasm-media-encoders';
import type { MonoTake } from './pcm.js';

/** Mono voice: small files, clear speech. */
export const RECORDING_BITRATE = 64;

/** The sample rates MPEG-1 Layer III takes as is; anything else is resampled. */
const MPEG1_RATES = [32000, 44100, 48000];

/** The LAME encoder's .wasm: a URL to fetch, or its bytes. */
export type Mp3Wasm = string | ArrayBuffer | Uint8Array;

/** Encode a mono take to CBR mp3 at `bitrate` kbps. */
export async function encodeMp3(
  take: MonoTake,
  wasm: Mp3Wasm,
  bitrate: typeof RECORDING_BITRATE = RECORDING_BITRATE,
): Promise<Uint8Array> {
  const encoder = await createEncoder('audio/mpeg', wasm);
  encoder.configure({
    sampleRate: take.sampleRate,
    channels: 1,
    bitrate,
    ...(MPEG1_RATES.includes(take.sampleRate) ? {} : { outputSampleRate: 44100 }),
  });
  // The encoder owns each returned array until the next call: copy as we go.
  const parts: Uint8Array[] = [];
  const block = 1152 * 64;
  for (let i = 0; i < take.samples.length; i += block) {
    parts.push(encoder.encode([take.samples.subarray(i, i + block)]).slice());
  }
  parts.push(encoder.finalize().slice());
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** What the frames of an mp3 say about it. */
export interface Mp3Summary {
  frames: number;
  /** Every bit rate seen, in kbps, ascending: one entry means CBR. */
  bitrates: number[];
  sampleRate: number;
  /** Seconds, from the frame count (1152 samples per MPEG-1 frame, 576 otherwise). */
  duration: number;
}

const V1_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const V2_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/** Walk the Layer III frames of an mp3 (skipping an ID3v2 tag). */
export function summarizeMp3(bytes: Uint8Array): Mp3Summary {
  let i = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    i = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
  }
  const seen = new Set<number>();
  let frames = 0;
  let sampleRate = 0;
  let samples = 0;
  while (i + 4 <= bytes.length) {
    const version = (bytes[i + 1] >> 3) & 3; // 3 MPEG-1, 2 MPEG-2, 0 MPEG-2.5
    const layer = (bytes[i + 1] >> 1) & 3; // 1 Layer III
    const kbpsIndex = bytes[i + 2] >> 4;
    const rateIndex = (bytes[i + 2] >> 2) & 3;
    const isFrame =
      bytes[i] === 0xff &&
      (bytes[i + 1] & 0xe0) === 0xe0 &&
      version !== 1 &&
      layer === 1 &&
      kbpsIndex !== 0 &&
      kbpsIndex !== 15 &&
      rateIndex !== 3;
    if (!isFrame) {
      i++;
      continue;
    }
    const mpeg1 = version === 3;
    const kbps = (mpeg1 ? V1_KBPS : V2_KBPS)[kbpsIndex];
    const rate = [44100, 48000, 32000][rateIndex] / (mpeg1 ? 1 : version === 2 ? 2 : 4);
    const padding = (bytes[i + 2] >> 1) & 1;
    seen.add(kbps);
    sampleRate = rate;
    samples += mpeg1 ? 1152 : 576;
    frames++;
    i += Math.floor(((mpeg1 ? 144000 : 72000) * kbps) / rate) + padding;
  }
  return {
    frames,
    bitrates: [...seen].sort((a, b) => a - b),
    sampleRate,
    duration: sampleRate ? samples / sampleRate : 0,
  };
}
