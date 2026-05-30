import { describe, it, expect } from 'vitest';
import { MARC_RELATORS, marcLabel, marcSelectOptions } from './marc-relators.js';

describe('marc-relators', () => {
  it('has unique codes', () => {
    const codes = MARC_RELATORS.map(r => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('includes the core book roles', () => {
    const codes = MARC_RELATORS.map(r => r.code);
    expect(codes).toEqual(expect.arrayContaining(['aut', 'edt', 'ill', 'trl']));
  });

  it('marcLabel returns the human label for a known code', () => {
    expect(marcLabel('aut')).toBe('Author');
    expect(marcLabel('ill')).toBe('Illustrator');
  });

  it('marcLabel falls back to the code for an unknown code', () => {
    expect(marcLabel('zzz')).toBe('zzz');
  });

  it('marcSelectOptions returns {value,label} pairs', () => {
    const options = marcSelectOptions();
    expect(options.length).toBe(MARC_RELATORS.length);
    expect(options[0]).toEqual({ value: 'aut', label: 'Author' });
  });
});
