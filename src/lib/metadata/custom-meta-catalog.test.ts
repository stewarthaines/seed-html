import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCustomMetaCatalog,
  catalogEntryLabel,
  BUILTIN_CATALOG_ENTRIES,
  entryId,
  inferValueType,
} from './custom-meta-catalog.svelte.js';

const KEY = 'test_custom_meta_catalog';

describe('customMetaCatalog', () => {
  beforeEach(() => localStorage.clear());

  it('starts with exactly the built-in entries; only the flagship two enabled', () => {
    const catalog = createCustomMetaCatalog(KEY);
    expect(catalog.entries).toHaveLength(BUILTIN_CATALOG_ENTRIES.length);
    expect(catalog.entries.every(e => e.source === 'builtin')).toBe(true);
    expect(catalog.entries.filter(e => e.enabled).map(e => e.key)).toEqual([
      'ibooks:specified-fonts',
      'cover',
    ]);
    expect(catalog.find('ibooks:specified-fonts', 'property')?.valueType).toBe('boolean');
    expect(catalog.find('cover', 'name')?.valueType).toBe('text');
  });

  it('starter pack entries ship disabled, carry groups, and enable persistently', () => {
    const catalog = createCustomMetaCatalog(KEY);
    const writingMode = catalog.find('primary-writing-mode', 'name');
    expect(writingMode).toMatchObject({ enabled: false, valueType: 'enum', group: 'Kindle' });
    expect(writingMode?.options).toEqual([
      'horizontal-lr',
      'horizontal-rl',
      'vertical-lr',
      'vertical-rl',
    ]);

    catalog.setEnabled('primary-writing-mode', 'name', true);
    expect(catalog.find('primary-writing-mode', 'name')?.enabled).toBe(true);
    expect(createCustomMetaCatalog(KEY).find('primary-writing-mode', 'name')?.enabled).toBe(true);
    // Non-removable like every builtin.
    catalog.remove('primary-writing-mode', 'name');
    expect(catalog.find('primary-writing-mode', 'name')).toBeDefined();
  });

  it('property-syntax pack entries carry the prefix URI needed to write them', () => {
    const catalog = createCustomMetaCatalog(KEY);
    expect(catalog.find('ebpaj:guide-version', 'property')?.prefixUri).toBe('http://www.ebpaj.jp/');
    expect(catalog.find('ibooks:scroll-axis', 'property')?.prefixUri).toContain(
      'vocabulary.itunes.apple.com'
    );
  });

  it('catalogEntryLabel translates builtin msgids and passes user labels through', () => {
    const catalog = createCustomMetaCatalog(KEY);
    const translate = (msgid: string) => `»${msgid}«`;
    const builtin = catalog.find('cover', 'name')!;
    expect(catalogEntryLabel(builtin, translate)).toBe('»EPUB 2 cover image (Google Play Books)«');

    catalog.adopt({ key: 'vendor:x', syntax: 'property', label: 'My Field' });
    expect(catalogEntryLabel(catalog.find('vendor:x', 'property')!, translate)).toBe('My Field');
    catalog.adopt({ key: 'vendor:y', syntax: 'property' });
    expect(catalogEntryLabel(catalog.find('vendor:y', 'property')!, translate)).toBe('vendor:y');
  });

  it('adopt adds a user entry with an inferred value type and persists it', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'calibre:series', syntax: 'name', sampleValue: 'The Chronicles' });

    const entry = catalog.find('calibre:series', 'name');
    expect(entry).toMatchObject({
      source: 'user',
      valueType: 'text',
      enabled: true,
    });
    // A fresh instance over the same key sees the persisted entry.
    expect(createCustomMetaCatalog(KEY).find('calibre:series', 'name')).toBeDefined();
  });

  it('adopt infers boolean from true/false samples and stores prefixUri', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({
      key: 'example:flag',
      syntax: 'property',
      sampleValue: 'true',
      prefixUri: 'https://example.org/vocab#',
    });

    expect(catalog.find('example:flag', 'property')).toMatchObject({
      valueType: 'boolean',
      prefixUri: 'https://example.org/vocab#',
    });
  });

  it('adopt is a no-op for duplicates and for built-in keys', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'calibre:series', syntax: 'name' });
    catalog.adopt({ key: 'calibre:series', syntax: 'name', sampleValue: 'true' });
    catalog.adopt({ key: 'cover', syntax: 'name' });

    expect(catalog.entries.filter(e => e.key === 'calibre:series')).toHaveLength(1);
    expect(catalog.find('calibre:series', 'name')?.valueType).toBe('text');
    expect(catalog.find('cover', 'name')?.source).toBe('builtin');
  });

  it('the same key can be adopted separately per syntax', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'vendor:x', syntax: 'name' });
    catalog.adopt({ key: 'vendor:x', syntax: 'property' });

    expect(catalog.entries.filter(e => e.key === 'vendor:x')).toHaveLength(2);
  });

  it('remove deletes user entries but never builtins', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'calibre:series', syntax: 'name' });

    catalog.remove('calibre:series', 'name');
    catalog.remove('cover', 'name');

    expect(catalog.find('calibre:series', 'name')).toBeUndefined();
    expect(catalog.find('cover', 'name')).toBeDefined();
  });

  it('setEnabled toggles builtins via a persisted override', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.setEnabled('ibooks:specified-fonts', 'property', false);

    expect(catalog.find('ibooks:specified-fonts', 'property')?.enabled).toBe(false);
    // Override persists; the builtin itself is still present.
    const fresh = createCustomMetaCatalog(KEY);
    expect(fresh.find('ibooks:specified-fonts', 'property')?.enabled).toBe(false);

    catalog.setEnabled('ibooks:specified-fonts', 'property', true);
    expect(catalog.find('ibooks:specified-fonts', 'property')?.enabled).toBe(true);
  });

  it('setEnabled toggles user entries', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'calibre:series', syntax: 'name' });
    catalog.setEnabled('calibre:series', 'name', false);

    expect(catalog.find('calibre:series', 'name')?.enabled).toBe(false);
  });

  it('setValueType and setPrefixUri edit user entries only', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'vendor:x', syntax: 'property' });

    catalog.setValueType('vendor:x', 'property', 'boolean');
    catalog.setPrefixUri('vendor:x', 'property', 'https://example.org/v#');
    catalog.setValueType('cover', 'name', 'boolean');

    expect(catalog.find('vendor:x', 'property')).toMatchObject({
      valueType: 'boolean',
      prefixUri: 'https://example.org/v#',
    });
    expect(catalog.find('cover', 'name')?.valueType).toBe('text');
  });

  it('setPrefixUri with an empty string clears the URI', () => {
    const catalog = createCustomMetaCatalog(KEY);
    catalog.adopt({ key: 'vendor:x', syntax: 'property', prefixUri: 'https://example.org/v#' });
    catalog.setPrefixUri('vendor:x', 'property', '  ');

    expect(catalog.find('vendor:x', 'property')?.prefixUri).toBeUndefined();
  });

  it('falls back to defaults on corrupt or malformed stored values', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createCustomMetaCatalog(KEY).entries).toHaveLength(BUILTIN_CATALOG_ENTRIES.length);

    localStorage.setItem(KEY, JSON.stringify({ user: 'nope', builtin: {} }));
    expect(createCustomMetaCatalog(KEY).entries).toHaveLength(BUILTIN_CATALOG_ENTRIES.length);

    // Invalid user entries are filtered, valid ones kept.
    localStorage.setItem(
      KEY,
      JSON.stringify({
        user: [
          { key: 'ok', syntax: 'name', valueType: 'text', enabled: true },
          { key: '', syntax: 'name', valueType: 'text', enabled: true },
          { key: 'bad-syntax', syntax: 'weird', valueType: 'text', enabled: true },
        ],
        builtin: { junk: { enabled: 'yes' } },
      })
    );
    const catalog = createCustomMetaCatalog(KEY);
    expect(catalog.entries.filter(e => e.source === 'user')).toHaveLength(1);
    expect(catalog.find('ok', 'name')).toBeDefined();
  });
});

describe('entryId / inferValueType', () => {
  it('entryId combines syntax and key', () => {
    expect(entryId({ key: 'cover', syntax: 'name' })).toBe('name:cover');
    expect(entryId({ key: 'cover', syntax: 'property' })).toBe('property:cover');
  });

  it('inferValueType treats only literal true/false as boolean', () => {
    expect(inferValueType('true')).toBe('boolean');
    expect(inferValueType('false')).toBe('boolean');
    expect(inferValueType('yes')).toBe('text');
    expect(inferValueType(undefined)).toBe('text');
  });
});
