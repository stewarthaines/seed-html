/**
 * `persisted()` — reactive state backed by localStorage, as a Svelte 5 rune.
 *
 * Replaces the hand-rolled "read-default-on-init + write-in-$effect + try/catch"
 * dance that was duplicated across the app. The write-through happens in the setter
 * (no `$effect`), so this works both inside components and at module scope (e.g. for
 * rune-based store modules).
 *
 * Each value is read/written through a {@link Codec} so the migration can keep every
 * key's existing on-disk format byte-for-byte — existing users don't lose saved prefs.
 *
 * Usage:
 * ```ts
 * const tab = persisted('editme_metadata_left_tab', 'basic', asEnum(TAB_IDS));
 * // read (reactive): tab.current   write (persists): tab.current = 'advanced'
 * ```
 * Setting `current` to `null`/`undefined` removes the key.
 */

export interface Codec<T> {
  /** Parse a stored string into T; return `undefined` when invalid (falls back to the default). */
  parse: (raw: string) => T | undefined;
  /** Serialize T for storage. Never called for `null`/`undefined` (those remove the key). */
  serialize: (value: T) => string;
}

export interface Persisted<T> {
  get current(): T;
  set current(value: T);
}

export function persisted<T>(
  key: string,
  // `NoInfer` so `T` is driven by the codec, not narrowed to the literal type of the
  // default (e.g. `''` would otherwise infer `T = ''` instead of `string`).
  initial: NoInfer<T>,
  // `NonNullable<T>` so a nullable value (e.g. `string | null`, which removes the key
  // when set to null) can still use a plain non-null codec like `asString`.
  codec: Codec<NonNullable<T>>
): Persisted<T> {
  function load(): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = codec.parse(raw);
      return parsed === undefined ? initial : parsed;
    } catch {
      return initial;
    }
  }

  let value = $state<T>(load());

  return {
    get current() {
      return value;
    },
    set current(next: T) {
      value = next;
      try {
        if (next == null) localStorage.removeItem(key);
        else localStorage.setItem(key, codec.serialize(next as NonNullable<T>));
      } catch {
        /* persistence is best-effort */
      }
    },
  };
}

// --- Codecs: each matches an existing on-disk format ------------------------------

/** Raw string, stored as-is. */
export const asString: Codec<string> = {
  parse: raw => raw,
  serialize: v => v,
};

/** Boolean stored as `"true"`/`"false"` (matches the legacy `String(bool)` format). */
export const asBoolean: Codec<boolean> = {
  parse: raw => (raw === 'true' ? true : raw === 'false' ? false : undefined),
  serialize: v => String(v),
};

/** Integer stored as its decimal string, optionally range-checked. */
export function asInt(opts: { min?: number; max?: number } = {}): Codec<number> {
  return {
    parse: raw => {
      const n = Number(raw);
      if (!Number.isInteger(n)) return undefined;
      if (opts.min !== undefined && n < opts.min) return undefined;
      if (opts.max !== undefined && n > opts.max) return undefined;
      return n;
    },
    serialize: v => String(v),
  };
}

/** One of a fixed set of string values (raw string, validated against the set). */
export function asEnum<T extends string>(values: readonly T[]): Codec<T> {
  return {
    parse: raw => (values.includes(raw as T) ? (raw as T) : undefined),
    serialize: v => v,
  };
}

/** Arbitrary JSON-serializable value. */
export function asJSON<T>(): Codec<T> {
  return {
    parse: raw => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    serialize: v => JSON.stringify(v),
  };
}
