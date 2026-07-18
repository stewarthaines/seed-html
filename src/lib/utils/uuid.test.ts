import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomUUID } from './uuid.js';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.restoreAllMocks());

describe('randomUUID', () => {
  it('produces a v4 UUID', () => {
    expect(randomUUID()).toMatch(V4);
  });

  it('produces a v4 UUID without crypto.randomUUID (insecure context / old Safari)', () => {
    vi.stubGlobal('crypto', {
      randomUUID: undefined,
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    const a = randomUUID();
    const b = randomUUID();
    expect(a).toMatch(V4);
    expect(b).toMatch(V4);
    expect(a).not.toBe(b);
  });
});
