/**
 * Tests for the Responsive extension's transform — specifically the sr-switch
 * stamping for inline width alternatives ([Narrow]{.narrow}[Wide]{.wide}…).
 * The script runs in the transform iframe as `transformDOM`; here we load the
 * source and eval it the same way the sandbox does, then drive it with parsed
 * documents. The display policy itself is CSS (responsive.css) and is
 * exercised in the browser, not here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('extensions/responsive/transformResponsive.js', 'utf8');
const transformDOM = new Function(`${src}\nreturn transformDOM;`)() as (
  doc: Document,
  idref: string,
  ctx: unknown
) => Promise<Document>;

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
}

describe('transformResponsive (sr-switch stamping)', () => {
  it('stamps sr-switch on an element holding all three alternatives', async () => {
    const doc = parse(
      '<h2><span class="narrow">N</span><span class="wide">W</span><span class="full">F</span> device</h2>'
    );
    await transformDOM(doc, 'ch1', {});
    const h2 = doc.querySelector('h2')!;
    expect(h2.classList.contains('sr-switch')).toBe(true);
    expect(h2.classList.contains('no-wide')).toBe(false);
    expect(h2.classList.contains('no-full')).toBe(false);
  });

  it('stamps the missing-variant classes for partial sets', async () => {
    const doc = parse(
      '<p><span class="narrow">N</span><span class="full">F</span></p>' +
        '<p><span class="narrow">N</span><span class="wide">W</span></p>'
    );
    await transformDOM(doc, 'ch1', {});
    const [narrowFull, narrowWide] = [...doc.querySelectorAll('p')];
    expect(narrowFull.className).toContain('sr-switch');
    expect(narrowFull.className).toContain('no-wide');
    expect(narrowFull.className).not.toContain('no-full');
    expect(narrowWide.className).toContain('sr-switch');
    expect(narrowWide.className).toContain('no-full');
    expect(narrowWide.className).not.toContain('no-wide');
  });

  it('leaves lone .narrow usage alone (no second variant, no stamp)', async () => {
    const doc = parse('<p><span class="narrow">just styling</span></p>');
    await transformDOM(doc, 'ch1', {});
    expect(doc.querySelector('.sr-switch')).toBeNull();
  });

  it('requires the variants to be siblings of .narrow', async () => {
    const doc = parse(
      '<div><p><span class="narrow">N</span></p><p><span class="wide">W</span></p></div>'
    );
    await transformDOM(doc, 'ch1', {});
    expect(doc.querySelector('.sr-switch')).toBeNull();
  });

  it('is idempotent across pipeline re-runs', async () => {
    const doc = parse('<h2><span class="narrow">N</span><span class="wide">W</span></h2>');
    await transformDOM(doc, 'ch1', {});
    await transformDOM(doc, 'ch1', {});
    const h2 = doc.querySelector('h2')!;
    expect(h2.className.match(/sr-switch/g)).toHaveLength(1);
    expect(h2.className.match(/no-full/g)).toHaveLength(1);
  });

  it('still wraps the page and figures (existing behavior intact)', async () => {
    const doc = parse('<p>text</p><figure><img src="x.png"/></figure>');
    await transformDOM(doc, 'ch1', {});
    expect(doc.body.firstElementChild?.className).toBe('sr-page');
    expect(doc.querySelector('.sr-figure > figure')).not.toBeNull();
  });
});
