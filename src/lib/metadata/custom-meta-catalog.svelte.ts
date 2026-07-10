/**
 * Custom metadata catalog — the app-level (browser-local, cross-project) list
 * of OPF meta fields the app "recognizes" with an editable row in the
 * Metadata view's Custom metadata section.
 *
 * Recognition is UI-only: unknown metas are always preserved on round-trip by
 * the core parser/serializer (see opf-utils customMeta); adopting a field here
 * merely gives it a first-class editing row and offers it on every book.
 *
 * Built-in entries are pinned and non-removable (only their enabled flag is
 * persisted, as an override); user entries come from "Add to catalog" in the
 * Metadata view and are fully editable in Settings. Pattern follows
 * saved-feeds.ts (pinned defaults + user list) on the persisted() rune.
 */
import { persisted } from '../state/persisted.svelte.js';
import type { Codec } from '../state/persisted.svelte.js';
import type { CustomMetaSyntax } from '../epub/opf-utils.js';

export interface CatalogEntry {
  key: string; // e.g. "ibooks:specified-fonts", "cover", "calibre:series"
  syntax: CustomMetaSyntax;
  valueType: 'boolean' | 'text';
  // Display label for user entries; built-in labels are resolved via $t at
  // render time so they follow the active locale.
  label?: string;
  // prefix → URI declaration needed to WRITE a property-syntax key into a book
  // that never contained it. Harvested from the source book at adoption time;
  // absent when the source book itself never declared the prefix.
  prefixUri?: string;
  source: 'builtin' | 'user';
  enabled: boolean;
}

type UserEntry = Omit<CatalogEntry, 'source'>;

interface StoredCatalog {
  user: UserEntry[];
  // Built-in entries are code, not data; only their enabled flag persists,
  // keyed by entryId.
  builtin: Record<string, { enabled: boolean }>;
}

export const BUILTIN_CATALOG_ENTRIES: readonly CatalogEntry[] = [
  {
    key: 'ibooks:specified-fonts',
    syntax: 'property',
    valueType: 'boolean',
    prefixUri: 'http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/',
    source: 'builtin',
    enabled: true,
  },
  {
    key: 'cover',
    syntax: 'name',
    valueType: 'text',
    source: 'builtin',
    enabled: true,
  },
];

/** Stable identity for an entry: syntax + key (the same key can exist in both syntaxes). */
export function entryId(e: { key: string; syntax: CustomMetaSyntax }): string {
  return `${e.syntax}:${e.key}`;
}

/** Guess an adoption default from the value seen in the source book. */
export function inferValueType(sample?: string): 'boolean' | 'text' {
  return sample === 'true' || sample === 'false' ? 'boolean' : 'text';
}

const isSyntax = (v: unknown): v is CustomMetaSyntax => v === 'property' || v === 'name';
const isValueType = (v: unknown): v is 'boolean' | 'text' => v === 'boolean' || v === 'text';

function isUserEntry(v: unknown): v is UserEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.key === 'string' &&
    e.key.length > 0 &&
    isSyntax(e.syntax) &&
    isValueType(e.valueType) &&
    typeof e.enabled === 'boolean' &&
    (e.label === undefined || typeof e.label === 'string') &&
    (e.prefixUri === undefined || typeof e.prefixUri === 'string')
  );
}

// Defensive shape validation: a corrupt or foreign value falls back to the
// default rather than poisoning every metadata render.
const catalogCodec: Codec<StoredCatalog> = {
  parse: raw => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return undefined;
      const candidate = parsed as Record<string, unknown>;
      if (!Array.isArray(candidate.user)) return undefined;
      if (typeof candidate.builtin !== 'object' || candidate.builtin === null) return undefined;
      const builtin: StoredCatalog['builtin'] = {};
      for (const [id, override] of Object.entries(candidate.builtin)) {
        const enabled = (override as Record<string, unknown> | null)?.enabled;
        if (typeof enabled === 'boolean') builtin[id] = { enabled };
      }
      return { user: candidate.user.filter(isUserEntry), builtin };
    } catch {
      return undefined;
    }
  },
  serialize: v => JSON.stringify(v),
};

const EMPTY_CATALOG: StoredCatalog = { user: [], builtin: {} };

export interface CustomMetaCatalog {
  /** Built-ins first (with persisted enabled overrides), then user entries. Reactive. */
  readonly entries: CatalogEntry[];
  find(key: string, syntax: CustomMetaSyntax): CatalogEntry | undefined;
  /** Add a discovered field. No-op when the (syntax, key) already exists (incl. builtins). */
  adopt(input: {
    key: string;
    syntax: CustomMetaSyntax;
    sampleValue?: string;
    prefixUri?: string;
    label?: string;
  }): void;
  /** Remove a user entry. No-op for builtins. */
  remove(key: string, syntax: CustomMetaSyntax): void;
  setEnabled(key: string, syntax: CustomMetaSyntax, enabled: boolean): void;
  /** Change a user entry's value type. No-op for builtins. */
  setValueType(key: string, syntax: CustomMetaSyntax, valueType: 'boolean' | 'text'): void;
  /** Supply the prefix URI a user property-syntax entry is missing. No-op for builtins. */
  setPrefixUri(key: string, syntax: CustomMetaSyntax, prefixUri: string): void;
}

/**
 * Create a catalog bound to a localStorage key. The app uses the
 * customMetaCatalog singleton below; tests create isolated instances.
 */
export function createCustomMetaCatalog(
  storageKey = 'seedhtml_custom_meta_catalog'
): CustomMetaCatalog {
  const store = persisted<StoredCatalog>(storageKey, EMPTY_CATALOG, catalogCodec);

  const updateUser = (
    key: string,
    syntax: CustomMetaSyntax,
    patch: (entry: UserEntry) => UserEntry
  ) => {
    const current = store.current;
    const index = current.user.findIndex(e => e.key === key && e.syntax === syntax);
    if (index === -1) return;
    const user = [...current.user];
    user[index] = patch(user[index]);
    store.current = { ...current, user };
  };

  return {
    get entries() {
      const stored = store.current;
      const builtins = BUILTIN_CATALOG_ENTRIES.map(entry => ({
        ...entry,
        enabled: stored.builtin[entryId(entry)]?.enabled ?? entry.enabled,
      }));
      const users = stored.user.map(entry => ({ ...entry, source: 'user' as const }));
      return [...builtins, ...users];
    },

    find(key, syntax) {
      return this.entries.find(e => e.key === key && e.syntax === syntax);
    },

    adopt({ key, syntax, sampleValue, prefixUri, label }) {
      if (this.find(key, syntax)) return;
      const entry: UserEntry = {
        key,
        syntax,
        valueType: inferValueType(sampleValue),
        label,
        prefixUri,
        enabled: true,
      };
      store.current = { ...store.current, user: [...store.current.user, entry] };
    },

    remove(key, syntax) {
      const current = store.current;
      const user = current.user.filter(e => !(e.key === key && e.syntax === syntax));
      if (user.length !== current.user.length) store.current = { ...current, user };
    },

    setEnabled(key, syntax, enabled) {
      const builtin = BUILTIN_CATALOG_ENTRIES.find(e => e.key === key && e.syntax === syntax);
      if (builtin) {
        store.current = {
          ...store.current,
          builtin: { ...store.current.builtin, [entryId(builtin)]: { enabled } },
        };
        return;
      }
      updateUser(key, syntax, entry => ({ ...entry, enabled }));
    },

    setValueType(key, syntax, valueType) {
      updateUser(key, syntax, entry => ({ ...entry, valueType }));
    },

    setPrefixUri(key, syntax, prefixUri) {
      updateUser(key, syntax, entry => ({ ...entry, prefixUri: prefixUri.trim() || undefined }));
    },
  };
}

/** The app-wide catalog (localStorage `seedhtml_custom_meta_catalog`). */
export const customMetaCatalog: CustomMetaCatalog = createCustomMetaCatalog();
