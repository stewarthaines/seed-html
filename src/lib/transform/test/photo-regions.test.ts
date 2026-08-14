/**
 * Tests for the photo-regions extension's DOM transform — carrier detection,
 * strict figure binding (with <p><img></p> conversion), overlay/caption
 * construction, of= link resolution through ctx.manifest, and the breadcrumb
 * failure mode. The script runs in the transform iframe as `transformDOM`;
 * here we load the source and eval it the same way the sandbox does. The
 * hover pairing itself is CSS (regions.css) and is exercised in the browser,
 * not here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('extensions/photo-regions/transformRegions.js', 'utf8');
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

const carrier =
  '<p class="region-set">' +
  '<span class="region" data-at="5.2,17.7,11.4,21.9" data-of="roger_king" data-as="Roger King" data-row="Back"></span>' +
  '<span class="region" data-at="17.3,14.8,9.9,20.4" data-as="Ian Vitcheff" data-row="Back"></span>' +
  '<span class="region" data-at="30,60,10,20" data-as="Amy Front" data-row="Front" data-badge="31,55"></span>' +
  '</p>';

describe('transformRegions (binding and construction)', () => {
  it('binds to a preceding figure, stamps name-faces, builds overlay and caption', async () => {
    const doc = parse(
      `<figure class="figure"><img src="../Images/team.jpg" alt="The team"/><figcaption>The survey team.</figcaption></figure>${carrier}`
    );
    await transformDOM(doc, 'ch1', {});

    const figure = doc.querySelector('figure')!;
    expect(figure.classList.contains('name-faces')).toBe(true);
    // The carrier paragraph is consumed.
    expect(doc.querySelector('p')).toBeNull();

    // Overlay: aria-hidden, one box + one badge per region, percent geometry.
    const overlay = figure.querySelector('.fc-overlay')!;
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.querySelectorAll('.fc-box').length).toBe(3);
    expect(overlay.querySelectorAll('.fc-badge').length).toBe(3);
    const box1 = overlay.querySelector('.fc-box-1') as HTMLElement;
    expect(box1.style.left).toBe('5.2%');
    expect(box1.style.width).toBe('11.4%');
    // Rows: Back is row 1, Front is row 2.
    expect(box1.classList.contains('fc-inrow-1')).toBe(true);
    expect(overlay.querySelector('.fc-box-3')!.classList.contains('fc-inrow-2')).toBe(true);

    // Badge default sits above the box; an explicit data-badge wins.
    const badge1 = overlay.querySelector('.fc-badge-1') as HTMLElement;
    expect(badge1.style.top).toBe('11.7%'); // 17.7 - 6 clearance
    expect(badge1.textContent).toBe('1');
    const badge3 = overlay.querySelector('.fc-badge-3') as HTMLElement;
    expect(badge3.style.left).toBe('31%');
    expect(badge3.style.top).toBe('55%');

    // The image now lives inside the positioning frame.
    expect(figure.querySelector('.fc-frame > img')).not.toBeNull();

    // Caption: appended after the existing text, grouped by row label.
    const figcaption = figure.querySelector('figcaption')!;
    expect(figcaption.textContent).toContain('The survey team.');
    const labels = [...figcaption.querySelectorAll('.fc-rowlabel')].map(el => el.textContent);
    expect(labels).toEqual(['Back', 'Front']);
    const names = [...figcaption.querySelectorAll('.fc-name')].map(el => el.textContent);
    expect(names).toEqual(['Roger King1', 'Ian Vitcheff2', 'Amy Front3']);
    expect(figcaption.querySelector('.fc-chip')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('converts a bare <p><img></p> to a figure and creates the figcaption', async () => {
    const doc = parse(
      `<p><img src="../Images/team.jpg" alt="The team" class="figure"/></p>` +
        `<p><span class="region" data-at="1,2,3,4" data-as="Solo Person"></span></p>`
    );
    await transformDOM(doc, 'ch1', {});

    const figure = doc.querySelector('figure')!;
    expect(figure).not.toBeNull();
    expect(figure.classList.contains('name-faces')).toBe(true);
    // The image keeps its own attributes (class lifting is a book concern).
    expect(figure.querySelector('img')!.classList.contains('figure')).toBe(true);
    expect(figure.querySelector('.fc-frame > img')).not.toBeNull();
    // Lone default row: no row label, just the name.
    const figcaption = figure.querySelector('figcaption')!;
    expect(figcaption.querySelector('.fc-rowlabel')).toBeNull();
    expect(figcaption.querySelector('.fc-name-1')!.textContent).toBe('Solo Person1');
  });

  it('links of= through ctx.manifest, never to the current chapter', async () => {
    const ctx = {
      manifest: [
        { id: 'ch1', href: 'Text/ch1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'roger_king', href: 'Text/roger_king.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'img1', href: 'Images/team.jpg', mediaType: 'image/jpeg' },
      ],
    };
    const body =
      '<figure><img src="../Images/team.jpg"/></figure>' +
      '<p><span class="region" data-at="1,2,3,4" data-of="roger_king" data-as="Roger King"></span>' +
      '<span class="region" data-at="5,6,7,8" data-of="ch1" data-as="Self Chapter"></span>' +
      '<span class="region" data-at="9,9,9,9" data-of="nobody" data-as="No Chapter"></span></p>';

    const doc = parse(body);
    await transformDOM(doc, 'ch1', ctx);

    const links = [...doc.querySelectorAll('.fc-name a')];
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('roger_king.xhtml');
    expect(links[0].textContent).toBe('Roger King');
    // Unresolvable and self ids degrade to plain text.
    expect(doc.querySelector('.fc-name-2')!.querySelector('a')).toBeNull();
    expect(doc.querySelector('.fc-name-3')!.querySelector('a')).toBeNull();
  });

  it('shows the of= id as the display name when as= is absent', async () => {
    const doc = parse(
      '<figure><img src="a.jpg"/></figure>' +
        '<p><span class="region" data-at="1,2,3,4" data-of="james_haddow"></span></p>'
    );
    await transformDOM(doc, 'ch1', {});
    expect(doc.querySelector('.fc-name-1')!.textContent).toBe('james_haddow1');
  });

  it('reconstitutes the directive as visible text when nothing bindable precedes', async () => {
    const doc = parse(
      '<p>Just prose.</p>' +
        '<p><span class="region" data-at="1,2,3,4" data-of="roger_king" data-as="Roger King" data-row="Back"></span>' +
        '<span class="region" data-at="5,6,7,8" data-as="Ian"></span></p>'
    );
    await transformDOM(doc, 'ch1', {});

    expect(doc.querySelector('figure')).toBeNull();
    expect(doc.querySelector('span.region')).toBeNull();
    const breadcrumb = [...doc.querySelectorAll('p')][1];
    expect(breadcrumb.textContent).toContain(
      ':region:{at="1,2,3,4" of=roger_king as="Roger King" row="Back"}'
    );
    expect(breadcrumb.textContent).toContain(':region:{at="5,6,7,8" as="Ian"}');
    expect(breadcrumb.querySelector('br')).not.toBeNull();
  });

  it('breadcrumbs the whole set when any data-at fails to parse', async () => {
    const doc = parse(
      '<figure><img src="a.jpg"/></figure>' +
        '<p><span class="region" data-at="1,2,3,4" data-as="Good"></span>' +
        '<span class="region" data-at="not,numbers,at,all" data-as="Bad"></span></p>'
    );
    await transformDOM(doc, 'ch1', {});
    expect(doc.querySelector('.fc-overlay')).toBeNull();
    expect(doc.querySelector('figure')!.classList.contains('name-faces')).toBe(false);
    expect(doc.body.textContent).toContain(':region:{at="not,numbers,at,all" as="Bad"}');
  });

  it('leaves ordinary paragraphs and non-region spans alone', async () => {
    const body =
      '<p>Prose with a <span class="clip" data-src="a.mp3">clip</span>.</p>' +
      '<p><span class="region" data-at="1,2,3,4"></span> trailing prose</p>';
    const doc = parse(body);
    await transformDOM(doc, 'ch1', {});
    // Mixed content is not a carrier; both paragraphs survive untouched.
    expect(doc.querySelectorAll('p').length).toBe(2);
    expect(doc.querySelector('span.region')).not.toBeNull();
    expect(doc.querySelector('span.clip')).not.toBeNull();
  });
});
