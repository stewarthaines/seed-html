/**
 * Pure list operations for the project's ordered `dom_transforms` array (the
 * DOM-transform pipeline edited in Settings). Kept Svelte-free so the add /
 * reorder / remove behaviour is unit-testable.
 */

/** The extension a script belongs to, i.e. `SOURCE/extensions/<name>/…`, else undefined. */
export function extensionOf(path: string): string | undefined {
  const m = path.match(/(?:^|\/)SOURCE\/extensions\/([^/]+)(?:\/|$)/);
  return m ? m[1] : undefined;
}

/** The basename of a script path. */
export function basename(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Canonicalize a configured transform path. A bare filename is assumed to live
 * in SOURCE/scripts/; anything already under SOURCE/ is returned unchanged.
 * Mirrors the rule the transform pipeline has always used, so the editor,
 * settings UI, validation and pipeline all resolve to the same real file.
 */
export function resolveTransformPath(name: string): string {
  return name.startsWith('SOURCE/') ? name : `SOURCE/scripts/${name}`;
}

/** Append `path` if it isn't already in the list (dedupe). */
export function addTransform(list: string[], path: string): string[] {
  return list.includes(path) ? list : [...list, path];
}

/** Remove the entry at `index` (no-op if out of range). */
export function removeTransformAt(list: string[], index: number): string[] {
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

/** Swap the entry at `index` with its neighbour; clamped at the ends. */
export function moveTransform(list: string[], index: number, dir: -1 | 1): string[] {
  const target = index + dir;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) {
    return list;
  }
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Display label for a script: its filename, plus the owning extension as a
 * group when the script lives under SOURCE/extensions/ (loose project scripts
 * get no group annotation).
 */
export function transformLabel(path: string): { name: string; group?: string } {
  return { name: basename(path), group: extensionOf(path) };
}

/** Group a script for the "Add" picker: its extension, or "Project scripts". */
export function transformGroup(path: string): string {
  return extensionOf(path) ?? 'Project scripts';
}
