import { describe, it, expect } from 'vitest';
import { cropTake, encodeWav, mixToMono, recordingFilename, takeDuration } from './pcm.js';

describe('mixToMono', () => {
  it('averages the channels', () => {
    const left = new Float32Array([1, 0, -1]);
    const right = new Float32Array([0, 0, 1]);
    expect(Array.from(mixToMono([left, right], 3))).toEqual([0.5, 0, 0]);
  });
});

describe('cropTake', () => {
  const take = { samples: Float32Array.from({ length: 1000 }, (_, i) => i), sampleRate: 100 };

  it('keeps the samples between begin and end', () => {
    const cropped = cropTake(take, 2, 3.5);
    expect(cropped.samples.length).toBe(150);
    expect(cropped.samples[0]).toBe(200);
    expect(takeDuration(cropped)).toBe(1.5);
  });

  it('clamps to the take and never goes backwards', () => {
    expect(cropTake(take, -1, 99).samples.length).toBe(1000);
    expect(cropTake(take, 5, 4).samples.length).toBe(0);
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and clamps samples', () => {
    const view = new DataView(encodeWav({ samples: new Float32Array([0, 2, -2]), sampleRate: 44100 }));
    const text = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)));
    expect(text(0)).toBe('RIFF');
    expect(text(8)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
  });
});

describe('recordingFilename', () => {
  it('names the file after the local date and time', () => {
    expect(recordingFilename(new Date(2026, 9, 6, 14, 32))).toBe('recording-2026-10-06-1432.mp3');
  });
});
