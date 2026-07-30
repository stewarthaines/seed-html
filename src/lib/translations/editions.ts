/**
 * Translation editions — the swap model (process/TRANSLATION_EDITIONS.md).
 *
 * The ACTIVE language always lives in `SOURCE/text/`; every inactive language
 * lives under `SOURCE/locale/<tag>/text/` (a mirror of the active tree) plus a
 * `meta.json` carrying the language-bearing OPF fields that travel with a
 * switch (title, title file-as, description). Switching language is a
 * journaled, move-based swap of the two trees: each file exists in exactly one
 * of the two locations at any moment, so an interrupted swap is resumed
 * deterministically from the journal plus a directory listing on next load.
 *
 * This module owns file mechanics only. OPF changes (language reorder, meta
 * overrides) are injected via a callback so the caller keeps the app's live
 * workspace state and save path authoritative. Callers are responsible for
 * re-rendering all chapters after add/switch/recovery — stored XHTML carries
 * xml:lang baked in at render time.
 *
 * `SOURCE/locale/**` is deliberately separate from the track-changes base
 * machinery under `SOURCE/main/**`: bases are deletable diff-optimised
 * artifacts; locale trees are permanent, human-readable editions.
 */

import type { FileStorageAPI } from '../storage/index.js';
import type { EPUBMetadata } from '../epub/opf-utils.js';

/** Directory (workspace-relative) that holds inactive-language editions. */
export const LOCALE_PREFIX = 'SOURCE/locale/';

/** Journal for an in-flight language switch; absent unless a swap is running. */
export const SWAP_JOURNAL_PATH = 'SOURCE/locale/.swap.json';

const TEXT_PREFIX = 'SOURCE/text/';

/** OPF fields that travel with a language switch (v1 scope, deliberately small). */
export interface TranslationMeta {
  title?: string;
  titleFileAs?: string;
  description?: string;
}

/**
 * Applies the OPF side of a switch: language reorder plus any incoming meta
 * overrides. Called exactly once per (possibly resumed) swap, before the
 * journal is deleted, so a crash around the OPF save re-applies on recovery.
 */
export type ApplySwapMetadata = (
  incoming: TranslationMeta | null,
  toTag: string,
  fromTag: string
) => Promise<void>;

// Swap phases, in execution order. `stash` moves the active tree out to
// locale/<from>; `restore` moves locale/<to> in; `metadata` applies OPF
// changes and cleans up.
const PHASES = ['stash', 'restore', 'metadata'] as const;
type SwapPhase = (typeof PHASES)[number];

interface SwapJournal {
  from: string;
  to: string;
  phase: SwapPhase;
}

/** `SOURCE/locale/<tag>/text/` */
export function localeTextPrefix(tag: string): string {
  return `${LOCALE_PREFIX}${tag}/text/`;
}

/** `SOURCE/locale/<tag>/meta.json` */
export function localeMetaPath(tag: string): string {
  return `${LOCALE_PREFIX}${tag}/meta.json`;
}

// BCP 47 tags are ASCII alphanumerics and hyphens; anything else would also be
// a path-injection risk since tags become directory names.
function assertSafeTag(tag: string): void {
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(tag)) {
    throw new Error(`Invalid language tag: ${tag}`);
  }
}

/** The swap-relevant fields of the current OPF metadata (non-empty values only). */
export function translationMetaFrom(metadata: Partial<EPUBMetadata>): TranslationMeta {
  const meta: TranslationMeta = {};
  if (metadata.title?.trim()) meta.title = metadata.title;
  if (metadata.titleFileAs?.trim()) meta.titleFileAs = metadata.titleFileAs;
  if (metadata.description?.trim()) meta.description = metadata.description;
  return meta;
}

/**
 * The OPF updates for making `toTag` the active language: it moves to the
 * front of dc:language (added if missing), `fromTag` is kept, and any incoming
 * meta overrides are applied. Absent override fields leave the OPF untouched.
 */
export function swapMetadataUpdates(
  metadata: Partial<EPUBMetadata>,
  toTag: string,
  fromTag: string,
  incoming: TranslationMeta | null
): Partial<EPUBMetadata> {
  const existing = Array.isArray(metadata.language)
    ? metadata.language
    : metadata.language
      ? [metadata.language as unknown as string]
      : [];
  const rest = existing.filter(tag => tag !== toTag);
  if (fromTag && !rest.includes(fromTag)) rest.push(fromTag);
  const updates: Partial<EPUBMetadata> = { language: [toTag, ...rest] };
  if (incoming?.title !== undefined) updates.title = incoming.title;
  if (incoming?.titleFileAs !== undefined) updates.titleFileAs = incoming.titleFileAs;
  if (incoming?.description !== undefined) updates.description = incoming.description;
  return updates;
}

/** Language tags with a stored edition under SOURCE/locale/, sorted. */
export async function listTranslations(
  fileStorage: FileStorageAPI,
  workspaceId: string
): Promise<string[]> {
  const files = await fileStorage.listFiles(workspaceId, 'SOURCE/locale');
  const tags = new Set<string>();
  for (const path of files) {
    const match = /^SOURCE\/locale\/([^/.][^/]*)\/text\//.exec(path);
    if (match) tags.add(match[1]);
  }
  return [...tags].sort();
}

async function moveTree(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  srcPrefix: string,
  destPrefix: string
): Promise<void> {
  const files = await fileStorage.listFiles(workspaceId, srcPrefix.replace(/\/+$/, ''));
  for (const src of files) {
    if (!src.startsWith(srcPrefix)) continue;
    const dest = destPrefix + src.slice(srcPrefix.length);
    // Copy-then-delete: at any crash point the file exists at src, dest, or
    // both, and src stays authoritative until its delete — so re-running the
    // move is always safe.
    const content = await fileStorage.readFile(workspaceId, src);
    await fileStorage.writeFile(workspaceId, dest, content);
    await fileStorage.deleteFile(workspaceId, src);
  }
}

async function deleteTree(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  prefix: string
): Promise<void> {
  const files = await fileStorage.listFiles(workspaceId, prefix.replace(/\/+$/, ''));
  for (const path of files) {
    if (path.startsWith(prefix)) await fileStorage.deleteFile(workspaceId, path);
  }
}

async function writeJournal(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  journal: SwapJournal
): Promise<void> {
  await fileStorage.writeTextFile(workspaceId, SWAP_JOURNAL_PATH, JSON.stringify(journal));
}

async function readJournal(
  fileStorage: FileStorageAPI,
  workspaceId: string
): Promise<SwapJournal | null> {
  if (!(await fileStorage.fileExists(workspaceId, SWAP_JOURNAL_PATH))) return null;
  const raw = await fileStorage.readTextFile(workspaceId, SWAP_JOURNAL_PATH);
  const parsed = JSON.parse(raw) as Partial<SwapJournal>;
  if (
    typeof parsed.from !== 'string' ||
    typeof parsed.to !== 'string' ||
    !PHASES.includes(parsed.phase as SwapPhase)
  ) {
    throw new Error('Unreadable language-switch journal');
  }
  assertSafeTag(parsed.from);
  assertSafeTag(parsed.to);
  return parsed as SwapJournal;
}

async function readIncomingMeta(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  tag: string
): Promise<TranslationMeta | null> {
  try {
    const raw = await fileStorage.readTextFile(workspaceId, localeMetaPath(tag));
    const parsed = JSON.parse(raw) as TranslationMeta;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null; // absent or unreadable — leave the OPF fields untouched
  }
}

/** Runs a swap forward from the journal's recorded phase to completion. */
async function runSwap(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  journal: SwapJournal,
  applyMetadata: ApplySwapMetadata
): Promise<string[]> {
  const startIndex = PHASES.indexOf(journal.phase);

  if (startIndex <= PHASES.indexOf('stash')) {
    await moveTree(fileStorage, workspaceId, TEXT_PREFIX, localeTextPrefix(journal.from));
    await writeJournal(fileStorage, workspaceId, { ...journal, phase: 'restore' });
  }
  if (startIndex <= PHASES.indexOf('restore')) {
    await moveTree(fileStorage, workspaceId, localeTextPrefix(journal.to), TEXT_PREFIX);
    await writeJournal(fileStorage, workspaceId, { ...journal, phase: 'metadata' });
  }

  const incoming = await readIncomingMeta(fileStorage, workspaceId, journal.to);
  await applyMetadata(incoming, journal.to, journal.from);
  // The incoming edition is now active — its locale/ entry dissolves entirely.
  await deleteTree(fileStorage, workspaceId, `${LOCALE_PREFIX}${journal.to}/`);
  await fileStorage.deleteFile(workspaceId, SWAP_JOURNAL_PATH);

  return await fileStorage.listFiles(workspaceId, TEXT_PREFIX.replace(/\/+$/, ''));
}

/**
 * Create a new translation: freeze the current text as the stored
 * `currentTag` edition; the active tree becomes the new `targetTag` edition
 * (initially identical, translated progressively in place).
 *
 * Copy-only and idempotent — a failed add is healed by re-adding. The caller
 * then makes `targetTag` primary in dc:language and re-renders all chapters.
 */
export async function addTranslation(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  options: { currentTag: string; targetTag: string; meta: TranslationMeta }
): Promise<void> {
  const { currentTag, targetTag, meta } = options;
  assertSafeTag(currentTag);
  assertSafeTag(targetTag);
  if (currentTag.toLowerCase() === targetTag.toLowerCase()) {
    throw new Error('The book is already in this language');
  }
  if (await fileStorage.fileExists(workspaceId, SWAP_JOURNAL_PATH)) {
    throw new Error('A language switch is still in progress');
  }
  const existing = await listTranslations(fileStorage, workspaceId);
  if (existing.some(tag => tag.toLowerCase() === targetTag.toLowerCase())) {
    throw new Error(`A ${targetTag} translation already exists`);
  }

  // A stored edition for the ACTIVE tag can only be debris from an
  // interrupted add — clear it so the frozen copy is exactly the current text.
  await deleteTree(fileStorage, workspaceId, `${LOCALE_PREFIX}${currentTag}/`);

  const textFiles = await fileStorage.listFiles(workspaceId, TEXT_PREFIX.replace(/\/+$/, ''));
  const destPrefix = localeTextPrefix(currentTag);
  for (const src of textFiles) {
    if (!src.startsWith(TEXT_PREFIX)) continue;
    const content = await fileStorage.readFile(workspaceId, src);
    await fileStorage.writeFile(workspaceId, destPrefix + src.slice(TEXT_PREFIX.length), content);
  }
  await fileStorage.writeTextFile(
    workspaceId,
    localeMetaPath(currentTag),
    JSON.stringify(meta, null, 2)
  );
}

/**
 * Switch the active language to a stored edition. Journaled and move-based:
 * an interrupted switch is completed by {@link recoverPendingSwap} on the next
 * workspace load. Returns the workspace-relative paths of the now-active text
 * files so the caller can notify open editors, before re-rendering all
 * chapters.
 */
export async function switchTranslation(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  options: {
    fromTag: string;
    toTag: string;
    outgoingMeta: TranslationMeta;
    applyMetadata: ApplySwapMetadata;
  }
): Promise<{ changedPaths: string[] }> {
  const { fromTag, toTag, outgoingMeta, applyMetadata } = options;
  assertSafeTag(fromTag);
  assertSafeTag(toTag);
  if (fromTag.toLowerCase() === toTag.toLowerCase()) {
    throw new Error('The book is already in this language');
  }
  if (await fileStorage.fileExists(workspaceId, SWAP_JOURNAL_PATH)) {
    throw new Error('A language switch is still in progress');
  }
  const incomingFiles = await fileStorage.listFiles(
    workspaceId,
    localeTextPrefix(toTag).replace(/\/+$/, '')
  );
  if (incomingFiles.length === 0) {
    throw new Error(`No stored ${toTag} translation to switch to`);
  }

  // Pre-journal setup, ordered so the outgoing meta overrides survive a crash
  // at any later point: clear add-debris for the outgoing tag, capture its
  // meta, and only then commit to the swap by writing the journal.
  await deleteTree(fileStorage, workspaceId, `${LOCALE_PREFIX}${fromTag}/`);
  await fileStorage.writeTextFile(
    workspaceId,
    localeMetaPath(fromTag),
    JSON.stringify(outgoingMeta, null, 2)
  );
  const journal: SwapJournal = { from: fromTag, to: toTag, phase: 'stash' };
  await writeJournal(fileStorage, workspaceId, journal);

  const changedPaths = await runSwap(fileStorage, workspaceId, journal, applyMetadata);
  return { changedPaths };
}

/**
 * Complete an interrupted language switch, if any. Call on workspace load,
 * before the user can edit. Returns what was recovered (with the now-active
 * text paths) so the caller can notify editors and re-render, or null when no
 * swap was pending.
 */
export async function recoverPendingSwap(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  applyMetadata: ApplySwapMetadata
): Promise<{ from: string; to: string; changedPaths: string[] } | null> {
  const journal = await readJournal(fileStorage, workspaceId);
  if (!journal) return null;
  const changedPaths = await runSwap(fileStorage, workspaceId, journal, applyMetadata);
  return { from: journal.from, to: journal.to, changedPaths };
}

/**
 * Delete a stored (inactive) translation. The caller confirms with the user
 * first and drops the tag from dc:language afterwards.
 */
export async function removeTranslation(
  fileStorage: FileStorageAPI,
  workspaceId: string,
  tag: string
): Promise<void> {
  assertSafeTag(tag);
  if (await fileStorage.fileExists(workspaceId, SWAP_JOURNAL_PATH)) {
    throw new Error('A language switch is still in progress');
  }
  await deleteTree(fileStorage, workspaceId, `${LOCALE_PREFIX}${tag}/`);
}
