import { describe, it, expect } from 'vitest';
import {
  addTransform,
  removeTransformAt,
  moveTransform,
  transformLabel,
  transformGroup,
  extensionOf,
  resolveTransformPath,
} from './dom-transforms.js';

describe('dom-transforms helpers', () => {
  describe('addTransform', () => {
    it('appends a new path', () => {
      expect(addTransform(['a'], 'b')).toEqual(['a', 'b']);
    });

    it('dedupes an existing path', () => {
      const list = ['a', 'b'];
      expect(addTransform(list, 'a')).toBe(list); // unchanged reference
    });
  });

  describe('removeTransformAt', () => {
    it('removes the entry at the index', () => {
      expect(removeTransformAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    });

    it('ignores an out-of-range index', () => {
      const list = ['a'];
      expect(removeTransformAt(list, 5)).toBe(list);
      expect(removeTransformAt(list, -1)).toBe(list);
    });
  });

  describe('moveTransform', () => {
    it('moves an entry up', () => {
      expect(moveTransform(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    });

    it('moves an entry down', () => {
      expect(moveTransform(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    });

    it('clamps at the ends', () => {
      const list = ['a', 'b'];
      expect(moveTransform(list, 0, -1)).toBe(list); // already first
      expect(moveTransform(list, 1, 1)).toBe(list); // already last
    });
  });

  describe('extensionOf', () => {
    it('returns the extension name for an extension script', () => {
      expect(extensionOf('SOURCE/extensions/mathjax/transform.js')).toBe('mathjax');
    });

    it('returns undefined for a loose project script', () => {
      expect(extensionOf('SOURCE/scripts/transformDom.js')).toBeUndefined();
    });
  });

  describe('transformLabel', () => {
    it('labels an extension script with its extension group', () => {
      expect(transformLabel('SOURCE/extensions/mathjax/transform.js')).toEqual({
        name: 'transform.js',
        group: 'mathjax',
      });
    });

    it('labels a loose project script with no group', () => {
      expect(transformLabel('SOURCE/scripts/transformDom.js')).toEqual({ name: 'transformDom.js' });
    });
  });

  describe('transformGroup', () => {
    it('groups extension scripts by extension name', () => {
      expect(transformGroup('SOURCE/extensions/mathjax/transform.js')).toBe('mathjax');
    });

    it('groups loose scripts under "Project scripts"', () => {
      expect(transformGroup('SOURCE/scripts/transformDom.js')).toBe('Project scripts');
    });
  });

  describe('resolveTransformPath', () => {
    it('prepends SOURCE/scripts/ to a bare filename', () => {
      expect(resolveTransformPath('transformDom.js')).toBe('SOURCE/scripts/transformDom.js');
    });

    it('leaves a full SOURCE/ path unchanged', () => {
      expect(resolveTransformPath('SOURCE/scripts/transformDom.js')).toBe(
        'SOURCE/scripts/transformDom.js'
      );
      expect(resolveTransformPath('SOURCE/extensions/mathjax/transform.js')).toBe(
        'SOURCE/extensions/mathjax/transform.js'
      );
    });
  });
});
