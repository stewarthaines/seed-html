/**
 * Screen reader announcement walk — pure logic for the preview pane's
 * Screen reader panel.
 *
 * The walk drives @guidepup/virtual-screen-reader (vendored at
 * public/sr-preview/, loaded into the preview iframe) over one element and
 * reports each announcement phrase. Kept free of Svelte and of the real
 * library so the target resolution, stop conditions, and driver loop are unit
 * testable.
 */

import { _ } from '$lib/i18n/msgid.js';

/** Elements an author can announce individually — the deepest match wins. */
export const ANNOUNCEABLE_SELECTOR =
  'h1, h2, h3, h4, h5, h6, p, li, figure, table, blockquote, aside, dl, pre';

/**
 * The block the hover affordance should target for an event target: the
 * nearest announceable ancestor-or-self. `closest()` walks upward, so an `li`
 * wins over its `ul` — item-level announcements ("listitem, position 12, set
 * size 40") keep the loop tight on long lists.
 */
export function resolveAnnounceTarget(el: Element): Element | null {
  return el.closest(ANNOUNCEABLE_SELECTOR);
}

/**
 * Whether a phrase ends the walk. The virtual screen reader announces
 * "end of X" whenever the cursor exits any container, so only the phrase for
 * the container the walk started from is terminal; a stuck cursor (repeated
 * phrase) or a wrap-around to the first phrase also ends the walk.
 */
export function isTerminalPhrase(phrase: string, prev: string, first: string): boolean {
  return (
    phrase === prev ||
    phrase === first ||
    phrase === 'end of document' ||
    phrase === `end of ${first}`
  );
}

// Role tokens as spoken by real screen readers, as translatable msgids. The
// virtual screen reader's phrases use raw ARIA role tokens ("listitem",
// "doc-noteref"), which no TTS voice can pronounce and no catalog covers.
// Each role carries its own "end of" msgid — never built by concatenation,
// because languages compound or inflect the pair ("Listenende", not
// "Ende von Listeneintrag").
const ROLES: Record<string, { spoken: string; end: string }> = {
  // document structure and landmarks
  document: { spoken: _('document'), end: _('end of document') },
  main: { spoken: _('main'), end: _('end of main') },
  region: { spoken: _('region'), end: _('end of region') },
  article: { spoken: _('article'), end: _('end of article') },
  banner: { spoken: _('banner'), end: _('end of banner') },
  complementary: { spoken: _('complementary'), end: _('end of complementary') },
  contentinfo: { spoken: _('content information'), end: _('end of content information') },
  navigation: { spoken: _('navigation'), end: _('end of navigation') },
  form: { spoken: _('form'), end: _('end of form') },
  search: { spoken: _('search'), end: _('end of search') },
  // text structure
  heading: { spoken: _('heading'), end: _('end of heading') },
  paragraph: { spoken: _('paragraph'), end: _('end of paragraph') },
  blockquote: { spoken: _('block quote'), end: _('end of block quote') },
  list: { spoken: _('list'), end: _('end of list') },
  listitem: { spoken: _('list item'), end: _('end of list item') },
  term: { spoken: _('term'), end: _('end of term') },
  definition: { spoken: _('definition'), end: _('end of definition') },
  note: { spoken: _('note'), end: _('end of note') },
  separator: { spoken: _('separator'), end: _('end of separator') },
  link: { spoken: _('link'), end: _('end of link') },
  emphasis: { spoken: _('emphasis'), end: _('end of emphasis') },
  strong: { spoken: _('strong'), end: _('end of strong') },
  code: { spoken: _('code'), end: _('end of code') },
  superscript: { spoken: _('superscript'), end: _('end of superscript') },
  subscript: { spoken: _('subscript'), end: _('end of subscript') },
  insertion: { spoken: _('insertion'), end: _('end of insertion') },
  deletion: { spoken: _('deletion'), end: _('end of deletion') },
  time: { spoken: _('time'), end: _('end of time') },
  // images and figures
  image: { spoken: _('image'), end: _('end of image') },
  figure: { spoken: _('figure'), end: _('end of figure') },
  caption: { spoken: _('caption'), end: _('end of caption') },
  'graphics-document': { spoken: _('graphic'), end: _('end of graphic') },
  'graphics-object': { spoken: _('graphic object'), end: _('end of graphic object') },
  'graphics-symbol': { spoken: _('graphic symbol'), end: _('end of graphic symbol') },
  // tables
  table: { spoken: _('table'), end: _('end of table') },
  row: { spoken: _('row'), end: _('end of row') },
  rowgroup: { spoken: _('row group'), end: _('end of row group') },
  cell: { spoken: _('cell'), end: _('end of cell') },
  columnheader: { spoken: _('column header'), end: _('end of column header') },
  rowheader: { spoken: _('row header'), end: _('end of row header') },
  // DPUB-ARIA — the EPUB-specific vocabulary, enumerated in full
  'doc-abstract': { spoken: _('abstract'), end: _('end of abstract') },
  'doc-acknowledgments': { spoken: _('acknowledgments'), end: _('end of acknowledgments') },
  'doc-afterword': { spoken: _('afterword'), end: _('end of afterword') },
  'doc-appendix': { spoken: _('appendix'), end: _('end of appendix') },
  'doc-backlink': { spoken: _('back link'), end: _('end of back link') },
  'doc-biblioentry': { spoken: _('bibliography entry'), end: _('end of bibliography entry') },
  'doc-bibliography': { spoken: _('bibliography'), end: _('end of bibliography') },
  'doc-biblioref': { spoken: _('bibliography reference'), end: _('end of bibliography reference') },
  'doc-chapter': { spoken: _('chapter'), end: _('end of chapter') },
  'doc-colophon': { spoken: _('colophon'), end: _('end of colophon') },
  'doc-conclusion': { spoken: _('conclusion'), end: _('end of conclusion') },
  'doc-cover': { spoken: _('cover'), end: _('end of cover') },
  'doc-credit': { spoken: _('credit'), end: _('end of credit') },
  'doc-credits': { spoken: _('credits'), end: _('end of credits') },
  'doc-dedication': { spoken: _('dedication'), end: _('end of dedication') },
  'doc-endnote': { spoken: _('endnote'), end: _('end of endnote') },
  'doc-endnotes': { spoken: _('endnotes'), end: _('end of endnotes') },
  'doc-epigraph': { spoken: _('epigraph'), end: _('end of epigraph') },
  'doc-epilogue': { spoken: _('epilogue'), end: _('end of epilogue') },
  'doc-errata': { spoken: _('errata'), end: _('end of errata') },
  'doc-example': { spoken: _('example'), end: _('end of example') },
  'doc-footnote': { spoken: _('footnote'), end: _('end of footnote') },
  'doc-foreword': { spoken: _('foreword'), end: _('end of foreword') },
  'doc-glossary': { spoken: _('glossary'), end: _('end of glossary') },
  'doc-glossref': { spoken: _('glossary reference'), end: _('end of glossary reference') },
  'doc-index': { spoken: _('index'), end: _('end of index') },
  'doc-introduction': { spoken: _('introduction'), end: _('end of introduction') },
  'doc-noteref': { spoken: _('note reference'), end: _('end of note reference') },
  'doc-notice': { spoken: _('notice'), end: _('end of notice') },
  'doc-pagebreak': { spoken: _('page break'), end: _('end of page break') },
  'doc-pagelist': { spoken: _('page list'), end: _('end of page list') },
  'doc-part': { spoken: _('part'), end: _('end of part') },
  'doc-preface': { spoken: _('preface'), end: _('end of preface') },
  'doc-prologue': { spoken: _('prologue'), end: _('end of prologue') },
  'doc-pullquote': { spoken: _('pull quote'), end: _('end of pull quote') },
  'doc-qna': { spoken: _('questions and answers'), end: _('end of questions and answers') },
  'doc-subtitle': { spoken: _('subtitle'), end: _('end of subtitle') },
  'doc-tip': { spoken: _('tip'), end: _('end of tip') },
  'doc-toc': { spoken: _('table of contents'), end: _('end of table of contents') },
};

// Numeral templates — interpolation only, safe to keep as frames.
const LEVEL_MSGID = _('level {n}');
const POSITION_MSGID = _('{x} of {y}');

/** Resolves a translated (or default-English) string for a vocabulary msgid. */
export type SpokenLookup = (msgid: string, params?: Record<string, string | number>) => string;

/** Default lookup: English msgids verbatim, with `{param}` interpolation. */
const passthrough: SpokenLookup = (msgid, params) =>
  params ? msgid.replace(/\{(\w+)\}/g, (m, key) => String(params[key] ?? m)) : msgid;

/**
 * Whether a phrase announces structure (roles, levels, positions) rather than
 * content text. Structural phrases open with a known role token, alone or
 * before a comma. English-shaped by design: classification always runs on the
 * library's raw phrases, never on translated output.
 */
export function isStructuralPhrase(phrase: string): boolean {
  const body = phrase.startsWith('end of ') ? phrase.slice('end of '.length) : phrase;
  const match = body.match(/^([a-z][a-z-]*)(?:,|$)/);
  return !!match && (match[1] in ROLES || match[1].startsWith('doc-'));
}

/**
 * The spoken form of an announcement phrase, in the vocabulary real screen
 * readers use: role tokens become words ("listitem" → "list item"), "position
 * x, set size y" becomes "x of y", "level n" stays a template. Pass `spoken`
 * (e.g. the i18n `translate`) to voice the vocabulary in the app's language;
 * the default is English. Captions use the same result; content text passes
 * through untouched either way.
 */
export function speakablePhrase(phrase: string, spoken: SpokenLookup = passthrough): string {
  const isEnd = phrase.startsWith('end of ');
  const body = isEnd ? phrase.slice('end of '.length) : phrase;
  const match = body.match(/^([a-z][a-z-]*)(?:,|$)/);
  if (!match) return phrase;
  const role = ROLES[match[1]];
  // Unknown roles (only future vocabulary — DPUB is enumerated in full) fall
  // back to untranslated English: prefix-stripped for doc-*, else the token.
  const lead = role
    ? spoken(isEnd ? role.end : role.spoken)
    : (isEnd ? 'end of ' : '') +
      (match[1].startsWith('doc-') ? match[1].slice(4).replaceAll('-', ' ') : match[1]);
  const rest = body
    .slice(match[1].length)
    .replace(/\blevel (\d+)/, (_m, n) => spoken(LEVEL_MSGID, { n }))
    .replace(/\bposition (\d+), set size (\d+)/, (_m, x, y) => spoken(POSITION_MSGID, { x, y }));
  return lead + rest;
}

/** The subset of the virtual screen reader the walk driver needs. */
export interface VsrLike {
  start(options: { container: Element; displayCursor?: boolean }): Promise<void>;
  next(): Promise<void>;
  stop(): Promise<void>;
  lastSpokenPhrase(): Promise<string>;
  /** The node under the cursor — the walk's authoritative "still inside the target?" signal. */
  readonly activeNode?: Node | null;
}

export interface WalkOptions {
  /** Aborts between steps; already-emitted phrases stand. */
  signal: AbortSignal;
  /**
   * Walk only this element, announced with its full document context. The
   * session still starts on `container` (ancestry outside the session's
   * container doesn't exist for the virtual screen reader — a nested li
   * walked as the container announces as "level 1"), and the cursor jumps to
   * the target via a transient tabindex + focus, which the virtual screen
   * reader follows like a real one.
   */
  target?: Element;
  /** Pause between steps so the in-preview cursor is followable. */
  stepDelayMs?: number;
  onPhrase: (phrase: string) => void;
  /** Backstop against a non-terminating cursor. */
  maxSteps?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Poll until the last spoken phrase changes from `previous` (or time out). */
async function awaitPhraseChange(
  vsr: VsrLike,
  previous: string,
  timeoutMs = 1500
): Promise<string> {
  const started = Date.now();
  for (;;) {
    const phrase = await vsr.lastSpokenPhrase();
    if (phrase !== previous) return phrase;
    if (Date.now() - started > timeoutMs) return phrase;
    await delay(50);
  }
}

/**
 * Walk `container` — or just `target` within it — emitting each announcement
 * phrase in order, including the terminal "end of …" phrase. Always stops the
 * virtual screen reader, even on abort or error; stop() failures are swallowed
 * (the target document may have been rewritten under the walk).
 */
export async function walkAnnouncements(
  vsr: VsrLike,
  container: Element,
  { signal, target, stepDelayMs = 90, onPhrase, maxSteps = 2000 }: WalkOptions
): Promise<void> {
  try {
    await vsr.start({ container, displayCursor: true });
    let first = await vsr.lastSpokenPhrase();
    if (target && target !== container) {
      const ownTabindex = target.getAttribute('tabindex');
      if (ownTabindex === null) target.setAttribute('tabindex', '-1');
      (target as HTMLElement).focus?.({ preventScroll: true });
      first = await awaitPhraseChange(vsr, first);
      if (ownTabindex === null) target.removeAttribute('tabindex');
    }
    onPhrase(first);
    let prev = first;
    for (let i = 0; i < maxSteps && !signal.aborted; i++) {
      if (stepDelayMs > 0) await delay(stepDelayMs);
      if (signal.aborted) break;
      await vsr.next();
      // The cursor leaving the target ends the walk — the authoritative stop
      // for elements that never announce an end phrase (a heading flattens
      // into one phrase; there is no "end of heading" to wait for).
      if (target && vsr.activeNode && !target.contains(vsr.activeNode)) break;
      const phrase = await vsr.lastSpokenPhrase();
      if (phrase === prev || phrase === first) break;
      onPhrase(phrase);
      if (isTerminalPhrase(phrase, prev, first)) break;
      prev = phrase;
    }
  } finally {
    try {
      await vsr.stop();
    } catch {
      // the preview document may have been rewritten mid-walk
    }
  }
}
