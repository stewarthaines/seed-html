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

/** Elements an author can announce individually — the deepest match wins. */
export const ANNOUNCEABLE_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, figure, table, blockquote, aside, dl, pre';

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

/** The subset of the virtual screen reader the walk driver needs. */
export interface VsrLike {
  start(options: { container: Element; displayCursor?: boolean }): Promise<void>;
  next(): Promise<void>;
  stop(): Promise<void>;
  lastSpokenPhrase(): Promise<string>;
}

export interface WalkOptions {
  /** Aborts between steps; already-emitted phrases stand. */
  signal: AbortSignal;
  /** Pause between steps so the in-preview cursor is followable. */
  stepDelayMs?: number;
  onPhrase: (phrase: string) => void;
  /** Backstop against a non-terminating cursor. */
  maxSteps?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Walk `container`, emitting each announcement phrase in order, including the
 * terminal "end of …" phrase. Always stops the virtual screen reader, even on
 * abort or error; stop() failures are swallowed (the target document may have
 * been rewritten under the walk).
 */
export async function walkAnnouncements(
  vsr: VsrLike,
  container: Element,
  { signal, stepDelayMs = 90, onPhrase, maxSteps = 2000 }: WalkOptions
): Promise<void> {
  try {
    await vsr.start({ container, displayCursor: true });
    const first = await vsr.lastSpokenPhrase();
    onPhrase(first);
    let prev = first;
    for (let i = 0; i < maxSteps && !signal.aborted; i++) {
      if (stepDelayMs > 0) await delay(stepDelayMs);
      if (signal.aborted) break;
      await vsr.next();
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
