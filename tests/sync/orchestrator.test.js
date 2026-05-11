import { describe, it, expect, vi } from 'vitest';
import { runSync } from '../../src/sync/orchestrator.js';

describe('runSync', () => {
  it('calls adapter.fetchAll then applyToZotero with the right source-parent name', async () => {
    const adapter = { fetchAll: vi.fn().mockResolvedValue({
      source: 'alphaxiv', user: { id: 'u' }, fetchedAt: 't', collections: [], notes: []
    }) };
    const apply = vi.fn().mockResolvedValue({ source: 'alphaxiv', papersWritten: 0, collectionsTouched: [], errors: [] });

    const result = await runSync({
      source: 'alphaxiv',
      adapter,
      apply,
      userPrefix: '/users/123'
    });

    expect(adapter.fetchAll).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
    const args = apply.mock.calls[0][0];
    expect(args.sourceParentName).toBe('AlphaXiv');
    expect(args.userPrefix).toBe('/users/123');
    expect(result.papersWritten).toBe(0);
  });

  it('uses Scholar-Inbox as the parent name for that source', async () => {
    const adapter = { fetchAll: vi.fn().mockResolvedValue({
      source: 'scholar-inbox', user: { id: '' }, fetchedAt: 't', collections: [], notes: []
    }) };
    const apply = vi.fn().mockResolvedValue({ source: 'scholar-inbox', papersWritten: 0, collectionsTouched: [], errors: [] });

    await runSync({ source: 'scholar-inbox', adapter, apply, userPrefix: '/users/123' });
    expect(apply.mock.calls[0][0].sourceParentName).toBe('Scholar-Inbox');
  });

  it('surfaces adapter errors as { ok:false, error }', async () => {
    const adapter = { fetchAll: vi.fn().mockRejectedValue(new Error('login required')) };
    const apply = vi.fn();
    const result = await runSync({ source: 'alphaxiv', adapter, apply, userPrefix: '/users/123' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/login required/);
    expect(apply).not.toHaveBeenCalled();
  });
});
