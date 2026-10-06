/**
 * Microphone capture for one take. MediaRecorder's own format differs by
 * browser (WebM or Ogg Opus, MP4 AAC) and only matters until the take is
 * decoded, so it is left to the browser.
 */

/** Where the audio comes from: the microphone, or a test's synthetic stream. */
export type StreamSource = () => Promise<MediaStream>;

export const microphone: StreamSource = () =>
  navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });

/** Whether this browser can record at all. */
export function canRecord(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export interface Capture {
  /** Ends the take and resolves to what the browser recorded. */
  stop(): Promise<Blob>;
  /** Ends the take and drops it. */
  cancel(): void;
  /** Current peak level, 0 to 1, for a meter. */
  level(): number;
}

/**
 * Start recording. `context` must have been created or resumed inside the
 * user's click, or iOS keeps it suspended.
 */
export async function startCapture(
  context: AudioContext,
  source: StreamSource = microphone,
): Promise<Capture> {
  const stream = await source();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  const input = context.createMediaStreamSource(stream);
  input.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(1000);

  const release = () => {
    input.disconnect();
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = release;
      if (recorder.state !== 'inactive') recorder.stop();
      else release();
    },
    level: () => {
      analyser.getFloatTimeDomainData(buffer);
      let peak = 0;
      for (const v of buffer) peak = Math.max(peak, Math.abs(v));
      return Math.min(1, peak);
    },
  };
}
