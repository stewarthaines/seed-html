/**
 * Unit tests for TransformExecutor — the synchronous in-scope runner for the
 * trusted bundled text transform (live on every new-project creation via
 * ContentService.transformContent).
 */

import { describe, it, expect } from 'vitest';
import { TransformExecutor } from '../transform-executor.js';
import { TransformError } from '../transform-error.js';

const executor = new TransformExecutor();

const run = (script: string, text = 'hello', idref?: string) =>
  executor.executeTextTransform(script, 'test.js', text, { idref });

describe('executeTextTransform', () => {
  it('runs the script and returns its string result', async () => {
    await expect(run('function transformText(t) { return "<p>" + t + "</p>"; }')).resolves.toBe(
      '<p>hello</p>'
    );
  });

  it('passes the idref as the second argument', async () => {
    await expect(
      run('function transformText(t, idref) { return t + ":" + idref; }', 'x', 'chapter-2')
    ).resolves.toBe('x:chapter-2');
  });

  it('exposes the scoped globals (JSON, Math) to the script', async () => {
    await expect(
      run('function transformText(t) { return JSON.stringify(Math.max(1, 2)); }')
    ).resolves.toBe('2');
  });

  it('makes extension-injected globals visible', async () => {
    const result = await executor.executeTextTransform(
      'function transformText(t) { return mylib.wrap(t); }',
      'test.js',
      'x',
      {},
      { globals: { mylib: { wrap: (s: string) => `[${s}]` } } }
    );

    expect(result).toBe('[x]');
  });

  it('rejects with a TransformError when transformText is missing', async () => {
    const attempt = run('function somethingElse() {}');

    await expect(attempt).rejects.toBeInstanceOf(TransformError);
    await expect(attempt).rejects.toMatchObject({
      stage: 'text',
      scriptName: 'test.js',
      message: expect.stringContaining('transformText is not defined'),
    });
  });

  it('rejects with a TransformError when the script throws', async () => {
    await expect(
      run('function transformText() { throw new Error("boom"); }')
    ).rejects.toMatchObject({ stage: 'text', message: 'boom' });
  });

  it('rejects instead of fabricating content when the transform returns a non-string', async () => {
    await expect(run('function transformText(t) { /* forgot to return */ }')).rejects.toMatchObject(
      { message: expect.stringContaining('undefined') }
    );
    await expect(run('function transformText(t) { return null; }')).rejects.toMatchObject({
      message: expect.stringContaining('null'),
    });
    await expect(run('function transformText(t) { return { html: t }; }')).rejects.toMatchObject({
      message: expect.stringContaining('object'),
    });
  });

  it('runs a slow-but-finite script to completion (no wall-clock timeout exists)', async () => {
    // Execution is synchronous on the caller's thread; this pins the documented
    // behavior that replaced the former fake timeout machinery.
    const script = `function transformText(t) {
      let n = 0;
      for (let i = 0; i < 2e6; i++) n += i;
      return String(n > 0);
    }`;

    await expect(run(script)).resolves.toBe('true');
  });
});
