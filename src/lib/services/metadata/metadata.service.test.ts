import { describe, it, expect, vi } from 'vitest';
import { MetadataService } from './metadata.service.js';
import type { WorkspaceService, WorkspaceState } from '../workspace/workspace.service.js';
import type { EPUBMetadata } from '../../epub/opf-utils.js';

function makeWorkspace(metadata: Partial<EPUBMetadata>): WorkspaceState {
  return {
    id: 'ws',
    opf: { metadata, manifest: [], spine: [] },
    pathInfo: { rootfilePath: 'OEBPS/content.opf' },
  } as unknown as WorkspaceState;
}

function makeService() {
  const workspaceService = {
    updateMetadata: vi.fn(async (ws: WorkspaceState, updates: Partial<EPUBMetadata>) => {
      ws.opf.metadata = { ...ws.opf.metadata, ...updates };
      return ws;
    }),
  } as unknown as WorkspaceService;
  return new MetadataService(workspaceService);
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
