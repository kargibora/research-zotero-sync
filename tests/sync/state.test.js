import { describe, it, expect } from 'vitest';
import { createSyncState } from '../../src/sync/state.js';

function makeStorage(initial = {}) {
  let store = { ...initial };
  return {
    async get(keys) {
      if (typeof keys === 'string') return { [keys]: store[keys] };
      const out = {};
      for (const k of Object.keys(keys || store)) out[k] = store[k] ?? keys?.[k];
      return out;
    },
    async set(obj) { Object.assign(store, obj); },
    _dump: () => ({ ...store })
  };
}

describe('createSyncState', () => {
  it('returns null for unknown keys', async () => {
    const state = createSyncState({ storage: makeStorage() });
    expect(await state.get('alphaxiv', '2504.10045')).toBeNull();
  });

  it('round-trips a record', async () => {
    const storage = makeStorage();
    const state = createSyncState({ storage });
    await state.put('alphaxiv', '2504.10045', { zoteroKey: 'ABCD', hash: 'h1' });

    const got = await state.get('alphaxiv', '2504.10045');
    expect(got.zoteroKey).toBe('ABCD');
    expect(got.hash).toBe('h1');
    expect(typeof got.lastSyncedAt).toBe('string');
  });

  it('hashes the parts of a paper that matter', async () => {
    const state = createSyncState({ storage: makeStorage() });
    const a = state.hashPaper({ title: 'A', abstract: 'x', authors: ['Q'], date: '2026' });
    const b = state.hashPaper({ title: 'A', abstract: 'x', authors: ['Q'], date: '2026' });
    const c = state.hashPaper({ title: 'A', abstract: 'y', authors: ['Q'], date: '2026' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
