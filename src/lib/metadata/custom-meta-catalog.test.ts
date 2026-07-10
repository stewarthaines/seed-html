import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCustomMetaCatalog,
  BUILTIN_CATALOG_ENTRIES,
  entryId,
  inferValueType,
} from './custom-meta-catalog.svelte.js';

const KEY = 'test_custom_meta_catalog';

describe('customMetaCatalog', () => {
  beforeEach(() => localStorage.clear());

  it('starts with exactly the built-in entries, enabled', () => {
    const catalog = createCustomMetaCatalog(KEY);
    expect(catalog.entries).toHaveLength(BUILTIN_CATALOG_ENTRIES.length);
    expect(catalog.entries.every(e => e.source === 'builtin' && e.enabled)).toBe(true);
    expect(catalog.find('ibooks:specified-fonts', 'property')?.valueType).toBe('boolean');
    expect(catalog.find('cover', 'name')?.valueType).toBe('text');
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
