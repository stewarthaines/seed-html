import { describe, it, expect } from 'vitest';
import { computeMovedOrder, isNoOpMove, rangeIds } from './chapters-reorder.js';

const ORDER = ['a', 'b', 'c', 'd'];
const sel = (...ids: string[]) => new Set(ids);

describe('computeMovedOrder', () => {
  it('moves a single item to a later gap', () => {
    // Move b to the gap before d (after c).
    expect(computeMovedOrder(ORDER, sel('b'), 3)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves a contiguous block to the start', () => {
    expect(computeMovedOrder(ORDER, sel('b', 'c'), 0)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a contiguous block to the end', () => {
    expect(computeMovedOrder(ORDER, sel('b', 'c'), ORDER.length)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves a non-contiguous selection as one block, preserving relative order', () => {
    expect(computeMovedOrder(ORDER, sel('a', 'c'), ORDER.length)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('returns a copy unchanged when nothing is selected', () => {
    const result = computeMovedOrder(ORDER, sel(), 2);
    expect(result).toEqual(ORDER);
    expect(result).not.toBe(ORDER);
  });
});

describe('isNoOpMove', () => {
  it('is true for a single item dropped either side of itself', () => {
    expect(isNoOpMove(ORDER, sel('b'), 1)).toBe(true); // before b
    expect(isNoOpMove(ORDER, sel('b'), 2)).toBe(true); // after b
  });

  it('is false for a single item that actually moves', () => {
    expect(isNoOpMove(ORDER, sel('b'), 3)).toBe(false);
  });

  it('is true for a block dropped at a gap interior/adjacent to itself', () => {
    expect(isNoOpMove(ORDER, sel('b', 'c'), 1)).toBe(true); // before the block
    expect(isNoOpMove(ORDER, sel('b', 'c'), 2)).toBe(true); // inside the block
    expect(isNoOpMove(ORDER, sel('b', 'c'), 3)).toBe(true); // inside the block
  });

  it('is false for a block that lands elsewhere', () => {
    expect(isNoOpMove(ORDER, sel('b', 'c'), 4)).toBe(false);
  });
});

describe('rangeIds', () => {
  it('returns the inclusive range regardless of argument order', () => {
    expect(rangeIds(ORDER, 1, 2)).toEqual(['b', 'c']);
    expect(rangeIds(ORDER, 2, 1)).toEqual(['b', 'c']);
  });

  it('clamps out-of-bounds indices to the list', () => {
    expect(rangeIds(ORDER, -5, 99)).toEqual(ORDER);
  });

  it('returns an empty array for an empty list', () => {
    expect(rangeIds([], 0, 3)).toEqual([]);
  });
});
