/**
 * SpeechService - thin wrapper over the Web Speech synthesis API
 *
 * Used by the preview pane's screen reader announcement panel to voice
 * announcement phrases. Isolates the API's known quirks: the voice list loads
 * asynchronously (empty until `voiceschanged`, which some engines never fire),
 * and utterances queue engine-side, so every stop path must go through
 * cancel() or queued speech keeps playing.
 */

export interface SpeakOptions {
  /** Playback rate, engine-clamped; 1 is normal speed. */
  rate?: number;
  /** voiceURI of a specific voice; omit for the engine default. */
  voiceURI?: string | null;
  /** BCP-47 tag hinting voice selection when no voiceURI is given. */
  lang?: string;
}

export class SpeechService {
  private synth: SpeechSynthesis | undefined;
  private voicesPromise: Promise<SpeechSynthesisVoice[]> | undefined;

  constructor(synth?: SpeechSynthesis) {
    if (synth) {
      this.synth = synth;
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  get supported(): boolean {
    return this.synth !== undefined;
  }

  /**
   * Resolve the voice list, waiting for `voiceschanged` when the first call
   * returns empty. Resolves to [] after a timeout so callers never hang on
   * engines that neither populate the list nor fire the event.
   */
  getVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
    const synth = this.synth;
    if (!synth) return Promise.resolve([]);
    const immediate = synth.getVoices();
    if (immediate.length > 0) return Promise.resolve(immediate);
    this.voicesPromise ??= new Promise(resolve => {
      const settle = () => {
        synth.removeEventListener('voiceschanged', settle);
        clearTimeout(timer);
        resolve(synth.getVoices());
      };
      const timer = setTimeout(settle, timeoutMs);
      synth.addEventListener('voiceschanged', settle);
    });
    return this.voicesPromise;
  }

  /** Voices matching a BCP-47 tag by primary-subtag prefix ('en' ~ 'en-AU'). */
  voicesForLang(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
    const primary = lang.toLowerCase().split('-')[0];
    if (!primary) return [];
    return voices.filter(v => v.lang.toLowerCase().split('-')[0] === primary);
  }

  /**
   * Queue one utterance. Queueing is the desired behaviour — phrases of a walk
   * play back to back — and cancel() flushes the whole queue.
   */
  speak(text: string, opts: SpeakOptions = {}, voices: SpeechSynthesisVoice[] = []): void {
    if (!this.synth) return;
    const utterance = new SpeechSynthesisUtterance(text);
    if (opts.rate !== undefined) utterance.rate = opts.rate;
    if (opts.lang) utterance.lang = opts.lang;
    if (opts.voiceURI) {
      const voice = voices.find(v => v.voiceURI === opts.voiceURI);
      if (voice) utterance.voice = voice;
    }
    this.synth.speak(utterance);
  }

  /** Flush the utterance queue and stop any current speech immediately. */
  cancel(): void {
    this.synth?.cancel();
  }
}
