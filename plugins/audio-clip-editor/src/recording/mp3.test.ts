import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { encodeMp3, summarizeMp3, RECORDING_BITRATE } from './mp3.js';

const require = createRequire(import.meta.url);
const wasm = new Uint8Array(readFileSync(require.resolve('wasm-media-encoders/wasm/mp3')));

/** Speech-like test signal: a wavering tone in syllable-length bursts. */
function voice(seconds: number, sampleRate: number): Float32Array {
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => {
    const t = i / sampleRate;
    return Math.max(0, Math.sin(t * Math.PI * 4)) * 0.4 * Math.sin(2 * Math.PI * (140 + 30 * Math.sin(t * 3)) * t);
  });
}

describe('encodeMp3', () => {
  for (const sampleRate of [44100, 48000]) {
    it(`gives constant-bit-rate frames at ${sampleRate} Hz, as long as the take`, async () => {
      const take = { samples: voice(5, sampleRate), sampleRate };
      const summary = summarizeMp3(await encodeMp3(take, wasm));
      expect(summary.bitrates).toEqual([RECORDING_BITRATE]);
      expect(summary.sampleRate).toBe(sampleRate);
      // LAME pads the start and the last frame: within a few frames of the take.
      expect(Math.abs(summary.duration - 5)).toBeLessThan(0.1);
    });
  }

  it('resamples a rate MPEG-1 cannot carry', async () => {
    const take = { samples: voice(2, 22050), sampleRate: 22050 };
    const summary = summarizeMp3(await encodeMp3(take, wasm));
    expect(summary.bitrates).toEqual([RECORDING_BITRATE]);
    expect(summary.sampleRate).toBe(44100);
  });
});

describe('summarizeMp3', () => {
  it('finds no frames in bytes that are not mp3', () => {
    expect(summarizeMp3(new Uint8Array([1, 2, 3, 4, 5, 6])).frames).toBe(0);
  });
});
