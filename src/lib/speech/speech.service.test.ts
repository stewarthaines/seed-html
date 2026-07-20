import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SpeechService } from './speech.service';

// happy-dom has no speech API at all — provide the utterance constructor the
// service news up (the engine itself is always injected as a fake below)
beforeAll(() => {
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      rate = 1;
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      constructor(public text: string) {}
    }
  );
});

type Listener = () => void;

function fakeSynth(initialVoices: Partial<SpeechSynthesisVoice>[] = []) {
  let voices = initialVoices as SpeechSynthesisVoice[];
  const listeners = new Set<Listener>();
  const spoken: SpeechSynthesisUtterance[] = [];
  const synth = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn((u: SpeechSynthesisUtterance) => spoken.push(u)),
    cancel: vi.fn(),
    addEventListener: vi.fn((_: string, fn: Listener) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: Listener) => listeners.delete(fn)),
  } as unknown as SpeechSynthesis;
  const setVoices = (next: Partial<SpeechSynthesisVoice>[]) => {
    voices = next as SpeechSynthesisVoice[];
    listeners.forEach(fn => fn());
  };
  return { synth, spoken, setVoices };
}

const voice = (voiceURI: string, lang: string) =>
  ({ voiceURI, lang, name: voiceURI }) as SpeechSynthesisVoice;

describe('SpeechService', () => {
  it('reports unsupported and stays inert without an engine', () => {
    const service = new SpeechService(undefined);
    // happy-dom provides no window.speechSynthesis
    expect(service.supported).toBe(false);
    expect(() => {
      service.speak('hello');
      service.cancel();
    }).not.toThrow();
  });

  it('resolves voices immediately when the engine has them', async () => {
    const { synth } = fakeSynth([voice('a', 'en-AU')]);
    const service = new SpeechService(synth);
    expect(await service.getVoices()).toHaveLength(1);
  });

  it('waits for voiceschanged when the first call is empty', async () => {
    const { synth, setVoices } = fakeSynth([]);
    const service = new SpeechService(synth);
    const pending = service.getVoices();
    setVoices([voice('a', 'en-AU'), voice('b', 'de-DE')]);
    expect(await pending).toHaveLength(2);
  });

  it('filters voices by primary language subtag', () => {
    const service = new SpeechService(fakeSynth().synth);
    const voices = [voice('a', 'en-AU'), voice('b', 'en-US'), voice('c', 'de-DE')];
    expect(service.voicesForLang(voices, 'en-GB').map(v => v.voiceURI)).toEqual(['a', 'b']);
    expect(service.voicesForLang(voices, 'de')).toHaveLength(1);
    expect(service.voicesForLang(voices, 'ka')).toHaveLength(0);
  });

  it('applies rate, lang, and a matching voice to utterances', () => {
    const { synth, spoken } = fakeSynth();
    const service = new SpeechService(synth);
    const voices = [voice('wanted', 'en-AU')];
    service.speak('heading, level 2', { rate: 1.5, lang: 'en', voiceURI: 'wanted' }, voices);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('heading, level 2');
    expect(spoken[0].rate).toBe(1.5);
    expect(spoken[0].lang).toBe('en');
    expect(spoken[0].voice?.voiceURI).toBe('wanted');
  });

  it('queues utterances and cancel() reaches the engine', () => {
    const { synth, spoken } = fakeSynth();
    const service = new SpeechService(synth);
    service.speak('one');
    service.speak('two');
    expect(spoken).toHaveLength(2);
    service.cancel();
    expect(synth.cancel).toHaveBeenCalled();
  });
});
