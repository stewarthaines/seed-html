import { describe, it, expect } from 'vitest';
import {
  addTransform,
  insertByStage,
  removeTransformAt,
  removeTransformsForExtension,
  moveTransform,
  transformLabel,
  transformGroup,
  extensionOf,
  resolveTransformPath,
} from './dom-transforms.js';
import type { DomTransformStage } from '../extensions/stages.js';

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

  describe('insertByStage', () => {
    const ext = (id: string, file = 'transform.js') => `SOURCE/extensions/${id}/${file}`;
    const PROJECT = 'SOURCE/scripts/transformDom.js';
    const stages: Record<string, DomTransformStage> = {
      prettier: 'blocks',
      figures: 'structure',
      'photo-regions': 'annotate',
      'family-history': 'derive',
      prism: 'highlight',
      responsive: 'layout',
    };
    const stageOf = (path: string) => {
      const id = extensionOf(path);
      return id ? stages[id] : undefined;
    };

    it('appends to an empty list', () => {
      expect(insertByStage([], [ext('figures')], 'structure', stageOf)).toEqual([ext('figures')]);
    });

    it('goes before the first later stage, after the project script', () => {
      const list = [PROJECT, ext('responsive')];
      expect(insertByStage(list, [ext('figures')], 'structure', stageOf)).toEqual([
        PROJECT,
        ext('figures'),
        ext('responsive'),
      ]);
    });

    it('goes after entries of its own and earlier stages', () => {
      const list = [ext('prettier'), ext('photo-regions'), ext('responsive')];
      expect(insertByStage(list, [ext('family-history')], 'derive', stageOf)).toEqual([
        ext('prettier'),
        ext('photo-regions'),
        ext('family-history'),
        ext('responsive'),
      ]);
    });

    it('appends when no entry has a later stage', () => {
      const list = [PROJECT, ext('prettier')];
      expect(insertByStage(list, [ext('responsive')], 'layout', stageOf)).toEqual([
        PROJECT,
        ext('prettier'),
        ext('responsive'),
      ]);
    });

    it('treats unstaged entries as transparent and never re-sorts them', () => {
      const list = [ext('responsive'), PROJECT, ext('legacy')];
      expect(insertByStage(list, [ext('figures')], 'structure', stageOf)).toEqual([
        ext('figures'),
        ext('responsive'),
        PROJECT,
        ext('legacy'),
      ]);
    });

    it('keeps an existing hand order that breaks the stage order', () => {
      const list = [ext('responsive'), ext('prettier')];
      expect(insertByStage(list, [ext('prism')], 'highlight', stageOf)).toEqual([
        ext('prism'),
        ext('responsive'),
        ext('prettier'),
      ]);
    });

    it('inserts a multi-script extension contiguously in declared order', () => {
      const list = [PROJECT, ext('responsive')];
      const paths = [ext('figures', 'a.js'), ext('figures', 'b.js')];
      expect(insertByStage(list, paths, 'structure', stageOf)).toEqual([
        PROJECT,
        ...paths,
        ext('responsive'),
      ]);
    });

    it('appends when the extension has no stage', () => {
      const list = [ext('responsive')];
      expect(insertByStage(list, [ext('legacy')], undefined, stageOf)).toEqual([
        ext('responsive'),
        ext('legacy'),
      ]);
    });

    it('leaves paths already in the list where they are', () => {
      const list = [ext('responsive'), ext('figures')];
      expect(insertByStage(list, [ext('figures')], 'structure', stageOf)).toBe(list);
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

  describe('removeTransformsForExtension', () => {
    it('drops only the named extension, keeping project scripts and other extensions', () => {
      const list = [
        'SOURCE/scripts/transformDom.js',
        'SOURCE/extensions/prism/transformPrism.js',
        'SOURCE/extensions/highlight/transformHighlight.js',
      ];
      expect(removeTransformsForExtension(list, 'prism')).toEqual([
        'SOURCE/scripts/transformDom.js',
        'SOURCE/extensions/highlight/transformHighlight.js',
      ]);
    });

    it('returns an equal list when the extension owns nothing', () => {
      const list = ['SOURCE/scripts/transformDom.js'];
      expect(removeTransformsForExtension(list, 'prism')).toEqual(list);
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
