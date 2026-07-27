// Pure reordering + selection helpers for the Chapters management view
// (process plan: velvety-yawning-sky). Kept free of Svelte/DOM so the move
// arithmetic and range-selection logic can be unit-tested directly.

/**
 * Move every selected id to an insertion gap, preserving the relative order of
 * both the moving block and the items that stay put.
 *
 * `insertionGap` is a gap index in the ORIGINAL order: 0 = before the first
 * item, `order.length` = after the last. A non-contiguous selection is moved as
 * one block (the selected items, in their current relative order) inserted at
 * the gap. Gaps that fall inside/adjacent to the selection yield the original
 * order (a no-op) — see {@link isNoOpMove}.
 */
export function computeMovedOrder(
  order: readonly string[],
  selected: ReadonlySet<string>,
  insertionGap: number
): string[] {
  const moving = order.filter(id => selected.has(id));
  if (moving.length === 0) return order.slice();

  const staying = order.filter(id => !selected.has(id));
  // How many staying items sit before the gap → where the block lands in staying[].
  const before = order.slice(0, insertionGap).filter(id => !selected.has(id)).length;
  return [...staying.slice(0, before), ...moving, ...staying.slice(before)];
}

/** True when moving the selection to this gap leaves the order unchanged. */
export function isNoOpMove(
  order: readonly string[],
  selected: ReadonlySet<string>,
  insertionGap: number
): boolean {
  const moved = computeMovedOrder(order, selected, insertionGap);
  return moved.length === order.length && moved.every((id, i) => id === order[i]);
}

/**
 * The ids in the inclusive index range between two positions (order-independent),
 * clamped to the list bounds. Used for shift-select range extension.
 */
export function rangeIds(order: readonly string[], a: number, b: number): string[] {
  if (order.length === 0) return [];
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(order.length - 1, Math.max(a, b));
  return order.slice(lo, hi + 1);
}
