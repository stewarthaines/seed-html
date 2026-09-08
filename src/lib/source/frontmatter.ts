/**
 * Chapter frontmatter (process/CHAPTER_FRONTMATTER.md, phase 1).
 *
 * A chapter source MAY begin with a YAML block fenced by `---` on line 1 and
 * a closing `---` line. The app splits it off BEFORE the text transform sees
 * the source — a leading `---` is a thematic break to djot and Markdown, so
 * the block cannot be left for the format to interpret — parses it with
 * js-yaml's JSON schema (dates stay strings: `1867-04-04` must not become a
 * Date), and stores the result as JSON under `SOURCE/data/frontmatter/`.
 *
 * Only line 1 triggers it. A `---` anywhere else is the format's business,
 * and a block that never closes is not a block: the text is returned intact
 * and the format gets its rule. A block that fails to parse is stripped
 * anyway — a typo must never leak a raw YAML dump into the book — and the
 * error is reported to the caller.
 *
 * The frontmatter is a transport, not a schema. Nothing here imposes keys;
 * consumers (the nav builder, extensions) validate what they own via
 * `ctx.frontmatter` and ignore the rest. YAML comments are part of the
 * convention in practice — authors keep provenance there — and a block that
 * is nothing but comments stores as `null`, the same as no block.
 */

import { load, JSON_SCHEMA } from 'js-yaml';

/** Directory (workspace-relative) holding one JSON record per chapter. */
export const FRONTMATTER_STORE_PREFIX = 'SOURCE/data/frontmatter/';

/** The store path for a chapter's record. */
export function frontmatterStorePath(idref: string): string {
  return `${FRONTMATTER_STORE_PREFIX}${idref}.json`;
}

export interface FrontmatterSplit {
  /** The source with the block removed — what the text transform receives. */
  body: string;
  /** The parsed block; `null` when there is none, it is empty, or it failed. */
  data: unknown;
  /** True when line 1 opened a block that closed (parsed or not). */
  hasBlock: boolean;
  /** The parser's message when the block did not parse. */
  error?: string;
}

const FENCE = /^---[ \t]*$/;

/**
 * Split a leading `---` YAML block from chapter text. Pure; tolerant of CRLF.
 */
export function splitFrontmatter(text: string): FrontmatterSplit {
  const lines = text.split(/\r?\n|\r/);
  if (lines.length < 2 || !FENCE.test(lines[0])) {
    return { body: text, data: null, hasBlock: false };
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    // Opened and never closed: a rule at the top of the chapter, not a block.
    return { body: text, data: null, hasBlock: false };
  }
  // Keep the original line endings for the body: re-split on the same text.
  const body = bodyAfterLine(text, close);
  const yaml = lines.slice(1, close).join('\n');
  try {
    const parsed = load(yaml, { schema: JSON_SCHEMA });
    return { body, data: parsed === undefined ? null : parsed, hasBlock: true };
  } catch (error) {
    return {
      body,
      data: null,
      hasBlock: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** The text after line index `line` (0-based), with its original line endings. */
function bodyAfterLine(text: string, line: number): string {
  const breaks = /\r\n|\n|\r/g;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = breaks.exec(text)) !== null) {
    if (index === line) return text.slice(match.index + match[0].length);
    index++;
  }
  return '';
}
