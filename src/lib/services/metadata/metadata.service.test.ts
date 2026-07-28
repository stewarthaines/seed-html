import { describe, it, expect, vi } from 'vitest';
import {
  MetadataService,
  MetadataServiceError,
  MetadataValidationError,
} from './metadata.service.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';
import type { EPUBMetadata } from '../../epub/opf-utils.js';

function makeWorkspace(metadata: Partial<EPUBMetadata>): WorkspaceState {
  return {
    id: 'ws',
    opf: { metadata, manifest: [], spine: [] },
    pathInfo: { rootfilePath: 'OEBPS/content.opf' },
  } as unknown as WorkspaceState;
}

function makeServiceWithMock() {
  const updateMetadata = vi.fn(async (ws: WorkspaceState, updates: Partial<EPUBMetadata>) => {
    ws.opf.metadata = { ...ws.opf.metadata, ...updates };
    return ws;
  });
  const workspaceService = { updateMetadata } as unknown as WorkspaceService;
  return { service: new MetadataService(workspaceService), updateMetadata };
}

function makeService() {
  return makeServiceWithMock().service;
}

describe('MetadataService creators', () => {
  it('addArrayItem appends an empty creator with no roles', async () => {
    const service = makeService();
    const ws = makeWorkspace({
      title: 'T',
      language: ['en'],
      identifier: 'id',
      creator: [{ name: 'Alice', roles: ['aut'] }],
    });

    const updated = await service.addArrayItem(ws, 'creator');

    expect(updated.opf.metadata.creator).toEqual([
      { name: 'Alice', roles: ['aut'] },
      { name: '', roles: [] },
    ]);
  });

  it('addArrayItem appends a string default for subjects', async () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id', subject: [] });

    const updated = await service.addArrayItem(ws, 'subject');

    expect(updated.opf.metadata.subject).toEqual(['New Subject']);
  });

  it('validateMetadata warns on an empty creator name', () => {
    const service = makeService();
    const results = service.validateMetadata({
      title: 'T',
      language: ['en'],
      identifier: 'id',
      creator: [{ name: '', roles: [] }],
    });

    expect(results.some(r => r.field === 'creator' && r.type === 'warning')).toBe(true);
  });

  it('addArrayItem appends an empty language tag', async () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const updated = await service.addArrayItem(ws, 'language');

    expect(updated.opf.metadata.language).toEqual(['en', '']);
  });

  it('validateMetadata errors when no language is present', () => {
    const service = makeService();
    const results = service.validateMetadata({ title: 'T', language: [], identifier: 'id' });

    expect(results.some(r => r.field === 'language' && r.type === 'error')).toBe(true);
  });

  it('validateMetadata errors on a malformed language tag but accepts BCP 47', () => {
    const service = makeService();

    const bad = service.validateMetadata({
      title: 'T',
      language: ['english'],
      identifier: 'id',
    });
    expect(bad.some(r => r.field === 'language[0]' && r.type === 'error')).toBe(true);

    const good = service.validateMetadata({
      title: 'T',
      language: ['en', 'zh-Hant', 'gsw'],
      identifier: 'id',
    });
    expect(good.some(r => r.field?.startsWith('language') && r.type === 'error')).toBe(false);
  });
});

describe('MetadataService.loadMetadata', () => {
  it('returns the metadata cached on the workspace state', () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    expect(service.loadMetadata(ws)).toBe(ws.opf.metadata);
  });
});

describe('MetadataService.updateField', () => {
  it('delegates a valid single-field update to the workspace service', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({ title: 'Old', language: ['en'], identifier: 'id' });

    const updated = await service.updateField(ws, 'title', 'New Title');

    expect(updateMetadata).toHaveBeenCalledWith(ws, { title: 'New Title' });
    expect(updated.opf.metadata.title).toBe('New Title');
  });

  it('throws MetadataValidationError for an empty title and does not persist', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({ title: 'Old', language: ['en'], identifier: 'id' });

    const error = await service.updateField(ws, 'title', '   ').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataValidationError);
    const validationError = error as MetadataValidationError;
    expect(validationError.code).toBe('VALIDATION_FAILED');
    expect(validationError.workspaceId).toBe('ws');
    expect(
      validationError.validationResults.some(r => r.field === 'title' && r.type === 'error')
    ).toBe(true);
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('throws MetadataValidationError when identifier is emptied', async () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    await expect(service.updateField(ws, 'identifier', '')).rejects.toBeInstanceOf(
      MetadataValidationError
    );
  });

  it('wraps workspace service failures as MetadataServiceError with UPDATE_ERROR', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    updateMetadata.mockRejectedValueOnce(new Error('disk full'));
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const error = await service.updateField(ws, 'title', 'New').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataServiceError);
    expect(error).not.toBeInstanceOf(MetadataValidationError);
    const serviceError = error as MetadataServiceError;
    expect(serviceError.code).toBe('UPDATE_ERROR');
    expect(serviceError.workspaceId).toBe('ws');
    expect(serviceError.message).toContain('title');
    expect(serviceError.message).toContain('disk full');
  });

  it('wraps non-Error rejections with an Unknown error message', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    updateMetadata.mockRejectedValueOnce('boom');
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const error = await service.updateField(ws, 'title', 'New').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataServiceError);
    expect((error as MetadataServiceError).message).toContain('Unknown error');
  });
});

describe('MetadataService.updateMetadata', () => {
  it('delegates a valid multi-field update to the workspace service', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({ title: 'Old', language: ['en'], identifier: 'id' });
    const updates = { title: 'New', identifier: 'urn:isbn:123' };

    const updated = await service.updateMetadata(ws, updates);

    expect(updateMetadata).toHaveBeenCalledWith(ws, updates);
    expect(updated.opf.metadata.title).toBe('New');
    expect(updated.opf.metadata.identifier).toBe('urn:isbn:123');
  });

  it('throws MetadataValidationError collecting all failing fields', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const error = await service
      .updateMetadata(ws, { title: '', identifier: '  ', language: [''] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataValidationError);
    const validationError = error as MetadataValidationError;
    const errorFields = validationError.validationResults
      .filter(r => r.type === 'error')
      .map(r => r.field);
    expect(errorFields).toEqual(expect.arrayContaining(['title', 'identifier', 'language']));
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('allows updates that only produce warnings (malformed language tag)', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const updated = await service.updateMetadata(ws, { language: ['not a tag!'] });

    expect(updateMetadata).toHaveBeenCalledOnce();
    expect(updated.opf.metadata.language).toEqual(['not a tag!']);
  });

  it('wraps workspace service failures as MetadataServiceError with UPDATE_ERROR', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    updateMetadata.mockRejectedValueOnce(new Error('write failed'));
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const error = await service.updateMetadata(ws, { title: 'New' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataServiceError);
    expect((error as MetadataServiceError).code).toBe('UPDATE_ERROR');
    expect((error as MetadataServiceError).message).toContain('write failed');
  });
});

describe('MetadataService.addArrayItem', () => {
  it('appends a structured contributor with the provided name', async () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const updated = await service.addArrayItem(ws, 'contributor', 'Bob');

    expect(updated.opf.metadata.contributor).toEqual([{ name: 'Bob', roles: [] }]);
  });

  it('starts a new array when the field is missing from metadata', async () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const updated = await service.addArrayItem(ws, 'subject', 'History');

    expect(updated.opf.metadata.subject).toEqual(['History']);
  });

  it('wraps workspace service failures as MetadataServiceError with ARRAY_ADD_ERROR', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    updateMetadata.mockRejectedValueOnce(new Error('nope'));
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id' });

    const error = await service.addArrayItem(ws, 'creator').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataServiceError);
    expect((error as MetadataServiceError).code).toBe('ARRAY_ADD_ERROR');
    expect((error as MetadataServiceError).workspaceId).toBe('ws');
  });
});

describe('MetadataService.removeArrayItem', () => {
  it('removes the item at the given index and persists the update', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({
      title: 'T',
      language: ['en'],
      identifier: 'id',
      subject: ['A', 'B', 'C'],
    });

    const updated = await service.removeArrayItem(ws, 'subject', 1);

    expect(updateMetadata).toHaveBeenCalledWith(ws, { subject: ['A', 'C'] });
    expect(updated.opf.metadata.subject).toEqual(['A', 'C']);
  });

  it('throws INVALID_INDEX for a negative index', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id', subject: ['A'] });

    const error = await service.removeArrayItem(ws, 'subject', -1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataServiceError);
    expect((error as MetadataServiceError).code).toBe('INVALID_INDEX');
    expect((error as MetadataServiceError).workspaceId).toBe('ws');
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('throws INVALID_INDEX when the index is past the end (including missing arrays)', async () => {
    const service = makeService();
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id', subject: ['A'] });

    await expect(service.removeArrayItem(ws, 'subject', 1)).rejects.toMatchObject({
      code: 'INVALID_INDEX',
    });
    await expect(service.removeArrayItem(ws, 'contributor', 0)).rejects.toMatchObject({
      code: 'INVALID_INDEX',
    });
  });

  it('wraps workspace service failures as MetadataServiceError with ARRAY_REMOVE_ERROR', async () => {
    const { service, updateMetadata } = makeServiceWithMock();
    updateMetadata.mockRejectedValueOnce(new Error('storage gone'));
    const ws = makeWorkspace({ title: 'T', language: ['en'], identifier: 'id', subject: ['A'] });

    const error = await service.removeArrayItem(ws, 'subject', 0).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MetadataServiceError);
    expect((error as MetadataServiceError).code).toBe('ARRAY_REMOVE_ERROR');
    expect((error as MetadataServiceError).message).toContain('storage gone');
  });
});

describe('MetadataService.validateMetadata', () => {
  it('returns no results for complete, well-formed metadata', () => {
    const service = makeService();
    const results = service.validateMetadata({
      title: 'T',
      language: ['en'],
      identifier: 'id',
      creator: [{ name: 'Alice', roles: ['aut'] }],
    });

    expect(results).toEqual([]);
  });

  it('errors on missing title and identifier', () => {
    const service = makeService();
    const results = service.validateMetadata({
      title: '',
      language: ['en'],
      identifier: '   ',
    });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', type: 'error' }),
        expect.objectContaining({ field: 'identifier', type: 'error' }),
      ])
    );
  });

  it('treats whitespace-only language entries as missing', () => {
    const service = makeService();
    const results = service.validateMetadata({ title: 'T', language: ['  '], identifier: 'id' });

    expect(results.some(r => r.field === 'language' && r.type === 'error')).toBe(true);
  });

  it('warns when the title exceeds 200 characters', () => {
    const service = makeService();
    const results = service.validateMetadata({
      title: 'x'.repeat(201),
      language: ['en'],
      identifier: 'id',
    });

    expect(results).toEqual([expect.objectContaining({ field: 'title', type: 'warning' })]);
  });
});

describe('MetadataService.validateMetadataUpdates', () => {
  it('returns no results when no validated fields are present', () => {
    const service = makeService();

    expect(service.validateMetadataUpdates({})).toEqual([]);
    expect(service.validateMetadataUpdates({ subject: [] })).toEqual([]);
  });

  it('accepts well-formed updates', () => {
    const service = makeService();
    const results = service.validateMetadataUpdates({
      title: 'T',
      language: ['en', 'zh-Hant'],
      identifier: 'urn:isbn:123',
    });

    expect(results).toEqual([]);
  });

  it('errors when the language list has no non-blank entries', () => {
    const service = makeService();
    const results = service.validateMetadataUpdates({ language: ['', '  '] });

    expect(results).toEqual([expect.objectContaining({ field: 'language', type: 'error' })]);
  });

  it('warns (not errors) on a malformed language tag', () => {
    const service = makeService();
    const results = service.validateMetadataUpdates({ language: ['english language'] });

    expect(results).toEqual([expect.objectContaining({ field: 'language', type: 'warning' })]);
  });
});
