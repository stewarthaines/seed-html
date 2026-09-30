/**
 * Tests for the list-of-figures extension's DOM transform: each image's source
 * and caption are recorded to SOURCE/data/figures/<idref>.json. The caption is
 * the authored one — when photo-regions has appended the named faces to a
 * figcaption, those names are not recorded. Scripts are loaded from the
 * extension sources and run in stage order, as the pipeline would.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

type DomTransform = (doc: Document, idref: string, ctx: unknown) => Document | Promise<Document>;
const load = (path: string) =>
  new Function(`${readFileSync(path, 'utf8')}\nreturn transformDOM;`)() as DomTransform;

const transformFigures = load('extensions/figures/transformFigures.js');
const transformRegions = load('extensions/photo-regions/transformRegions.js');
const storeImageReferences = load('extensions/list-of-figures/storeImageReferences.js');

function parse(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${body}</body></html>`,
    'text/html'
  );
}

async function recorded(body: string): Promise<{ src: string; caption: string }[]> {
  const written: Record<string, string> = {};
  const ctx = {
    manifest: [],
    readSourceText: async () => '{}',
    writeSourceText: async (path: string, text: string) => {
      written[path] = text;
    },
  };
  const doc = parse(body);
  for (const transform of [transformFigures, transformRegions, storeImageReferences]) {
    await transform(doc, 'ch1', ctx);
  }
  return JSON.parse(written['SOURCE/data/figures/ch1.json']);
}

const region =
  '<p class="region-set"><span class="region" data-at="5.2,17.7,11.4,21.9" data-as="Roger King" data-row="Back"></span></p>';

describe('storeImageReferences', () => {
  it('records the figcaption', async () => {
    expect(
      await recorded('<p><img class="figure" src="a.jpg" alt="A" title="The harbour."/></p>')
    ).toEqual([{ src: 'a.jpg', caption: 'The harbour.' }]);
  });

  it('records the authored caption without the names photo-regions adds', async () => {
    expect(
      await recorded(
        `<p><img class="figure" src="team.jpg" alt="The team" title="The survey team."/></p>${region}`
      )
    ).toEqual([{ src: 'team.jpg', caption: 'The survey team.' }]);
  });

  it('falls back to alt when a named-faces figure has no authored caption', async () => {
    expect(await recorded(`<p><img src="team.jpg" alt="The team"/></p>${region}`)).toEqual([
      { src: 'team.jpg', caption: 'The team' },
    ]);
  });

  it('falls back to alt for an image outside a figure', async () => {
    expect(await recorded('<p><img src="a.jpg" alt="A view"/></p>')).toEqual([
      { src: 'a.jpg', caption: 'A view' },
    ]);
  });
});
