import { describe, it, expect, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Recorder from './Recorder.svelte';
import { summarizeMp3, RECORDING_BITRATE } from './recording/mp3.js';
import './styles.css';

/**
 * The recorder in a real browser: MediaRecorder, decodeAudioData, wavesurfer
 * and the WASM encoder all run for real. A tone from an oscillator stands in
 * for the microphone, so no device or permission is needed.
 */
function toneSource(context: AudioContext) {
  return async () => {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 220;
    const destination = context.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    return destination.stream;
  };
}

async function until<T>(read: () => T | null | undefined, timeout = 10000): Promise<T> {
  const started = performance.now();
  for (;;) {
    const value = read();
    if (value) return value;
    if (performance.now() - started > timeout) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const button = (target: HTMLElement, name: string) =>
  [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === name && !b.disabled);

describe('Recorder', () => {
  it('records, then keeps the take as a constant-bit-rate mp3', async () => {
    const context = new AudioContext();
    await context.resume();
    const target = document.createElement('div');
    document.body.append(target);
    const addFile = vi.fn(async (_name: string, _type: string, _bytes: ArrayBuffer) => 'Audio/take.mp3');
    const onKept = vi.fn();
    const recorder = mount(Recorder, {
      target,
      props: { context, source: toneSource(context), addFile, onKept, onClose: () => {} },
    });

    const stop = await until(() => button(target, 'Stop'));
    await new Promise((r) => setTimeout(r, 1500));
    stop.click();
    flushSync();

    (await until(() => button(target, 'Keep'))).click();
    await until(() => onKept.mock.calls.length > 0, 15000);

    const [filename, mediaType, bytes] = addFile.mock.calls[0];
    expect(filename).toMatch(/^recording-\d{4}-\d{2}-\d{2}-\d{4}\.mp3$/);
    expect(mediaType).toBe('audio/mpeg');
    const summary = summarizeMp3(new Uint8Array(bytes));
    expect(summary.bitrates).toEqual([RECORDING_BITRATE]);
    const [href, duration] = onKept.mock.calls[0];
    expect(href).toBe('Audio/take.mp3');
    expect(duration).toBeGreaterThan(1);
    expect(Math.abs(summary.duration - duration)).toBeLessThan(0.1);

    unmount(recorder);
    target.remove();
    await context.close();
  });

  it('fetches the encoder as it opens, and keeps the take when saving fails', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    const context = new AudioContext();
    await context.resume();
    const target = document.createElement('div');
    document.body.append(target);
    const addFile = vi
      .fn(async (_name: string, _type: string, _bytes: ArrayBuffer) => 'Audio/take.mp3')
      .mockRejectedValueOnce(new Error('The app did not answer'));
    const onKept = vi.fn();
    const recorder = mount(Recorder, {
      target,
      props: { context, source: toneSource(context), addFile, onKept, onClose: () => {} },
    });

    const stop = await until(() => button(target, 'Stop'));
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('mp3'))).toBe(true);
    await new Promise((r) => setTimeout(r, 1000));
    stop.click();
    flushSync();

    (await until(() => button(target, 'Keep'))).click();
    const alert = await until(() => target.querySelector('[role="alert"]'));
    expect(alert.textContent).toContain('The app did not answer');
    expect(onKept).not.toHaveBeenCalled();

    (await until(() => button(target, 'Keep'))).click();
    await until(() => onKept.mock.calls.length > 0, 15000);
    expect(addFile).toHaveBeenCalledTimes(2);
    expect(target.querySelector('[role="alert"]')).toBeNull();

    unmount(recorder);
    target.remove();
    fetchSpy.mockRestore();
    await context.close();
  });
});
