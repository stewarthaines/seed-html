import { describe, it, expect, beforeEach } from 'vitest';
import { persisted, asString, asBoolean, asInt, asEnum, asJSON } from './persisted.svelte.js';

describe('codecs', () => {
  it('asBoolean round-trips the legacy "true"/"false" format', () => {
    expect(asBoolean.parse('true')).toBe(true);
    expect(asBoolean.parse('false')).toBe(false);
    expect(asBoolean.parse('garbage')).toBeUndefined();
    expect(asBoolean.serialize(true)).toBe('true');
  });

  it('asInt validates integer + range', () => {
    const c = asInt({ min: 0, max: 4 });
    expect(c.parse('3')).toBe(3);
    expect(c.parse('5')).toBeUndefined();
    expect(c.parse('2.5')).toBeUndefined();
    expect(c.parse('x')).toBeUndefined();
    expect(c.serialize(3)).toBe('3');
  });

  it('asEnum accepts only listed values', () => {
    const c = asEnum(['opf', 'summary'] as const);
    expect(c.parse('opf')).toBe('opf');
    expect(c.parse('nope')).toBeUndefined();
  });

  it('asJSON round-trips and rejects malformed JSON', () => {
    const c = asJSON<{ a: number }>();
    expect(c.parse(c.serialize({ a: 1 }))).toEqual({ a: 1 });
    expect(c.parse('{bad')).toBeUndefined();
  });
});

describe('persisted()', () => {
  beforeEach(() => localStorage.clear());

  it('returns the default when the key is absent', () => {
    expect(persisted('k', 'def', asString).current).toBe('def');
  });

  it('loads an existing value in its stored format', () => {
    localStorage.setItem('flag', 'true');
    expect(persisted('flag', false, asBoolean).current).toBe(true);
  });

  it('falls back to the default on an invalid stored value', () => {
    localStorage.setItem('n', 'garbage');
    expect(persisted('n', 2, asInt({ min: 0, max: 4 })).current).toBe(2);
  });

  it('persists on set, in the codec format', () => {
    const p = persisted('flag', false, asBoolean);
    p.current = true;
    expect(p.current).toBe(true);
    expect(localStorage.getItem('flag')).toBe('true');
  });

  it('removes the key when set to null', () => {
    localStorage.setItem('w', 'abc');
    const p = persisted<string | null>('w', null, asString);
    expect(p.current).toBe('abc');
    p.current = null;
    expect(localStorage.getItem('w')).toBeNull();
  });
});
