import { describe, it, expect, vi } from 'vitest';
import { applyToZotero } from '../../src/zotero/sync.js';

function makeRecorder(initial = {}) {
  const calls = [];
  const collections = { ...(initial.collections || {}) }; // key → {data:{name, parentCollection}}
  const items = { ...(initial.items || {}) };             // key → {data:{itemType, ...}, version}
  const childrenByParent = { ...(initial.children || {}) };
  let nextKey = 1000;
  const newKey = () => `K${nextKey++}`;

  async function fetchJson(path, options = {}) {
    calls.push({ path, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    const m = options.method || 'GET';

    if (m === 'GET' && /\/collections(\?|$)/.test(path)) {
      return Object.entries(collections).map(([key, v]) => ({ key, data: v.data }));
    }
    if (m === 'POST' && /\/collections$/.test(path)) {
      const created = JSON.parse(options.body);
      const result = { success: {} };
      created.forEach((c, i) => {
        const key = newKey();
        collections[key] = { data: { name: c.name, parentCollection: c.parentCollection || false } };
        result.success[String(i)] = key;
      });
      return result;
    }
    if (m === 'GET' && /\/items\?/.test(path)) {
      return [];
    }
    if (m === 'POST' && /\/items$/.test(path)) {
      const created = JSON.parse(options.body);
      const result = { success: {} };
      created.forEach((it, i) => {
        const key = newKey();
        items[key] = { data: it, version: 1 };
        if (it.parentItem) {
          (childrenByParent[it.parentItem] ||= []).push({ key, data: it, version: 1 });
        }
        result.success[String(i)] = key;
      });
      return result;
    }
    if (m === 'GET' && /\/items\/[^/]+\/children/.test(path)) {
      const parentKey = path.match(/\/items\/([^/]+)\/children/)[1];
      return childrenByParent[parentKey] || [];
    }
    if (m === 'PATCH' && /\/items\/[^/]+$/.test(path)) {
      const key = path.match(/\/items\/([^/]+)/)[1];
      items[key] = { data: { ...items[key].data, ...JSON.parse(options.body) }, version: items[key].version + 1 };
      return null;
    }
    if (m === 'GET' && /\/items\/[^/]+$/.test(path)) {
      const key = path.match(/\/items\/([^/]+)/)[1];
      return items[key] ? { key, data: items[key].data, version: items[key].version } : null;
    }
    throw new Error(`unhandled ${m} ${path}`);
  }

  return { fetchJson, calls, _state: { collections, items, childrenByParent } };
}

function makeState() {
  const map = new Map();
  return {
    get: vi.fn(async (s, id) => map.get(`${s}:${id}`) || null),
    put: vi.fn(async (s, id, rec) => { map.set(`${s}:${id}`, rec); }),
    hashPaper: vi.fn(() => 'h1')
  };
}

const adapterResult = {
  source: 'alphaxiv',
  fetchedAt: '2026-05-11T00:00:00Z',
  user: { id: 'u' },
  collections: [
    {
      sourceId: 'F1', name: 'My Folder', type: 'custom',
      papers: [{
        sourceId: '2504.10045', arxivId: '2504.10045', doi: '',
        title: 'Test Paper', abstract: 'abc', authors: ['Ada Lovelace'],
        date: '2026-01-01', pdfUrl: 'https://arxiv.org/pdf/2504.10045',
        addedAt: '', sourceUrl: 'https://www.alphaxiv.org/abs/2504.10045'
      }]
    }
  ],
  notes: [{ paperSourceId: '2504.10045', kind: 'comment', text: 'mine', createdAt: '2026-04' }]
};

describe('applyToZotero', () => {
  it('creates AlphaXiv parent + subcollection + item + child note', async () => {
    const recorder = makeRecorder();
    const state = makeState();
    const result = await applyToZotero({
      adapterResult,
      client: { fetchJson: recorder.fetchJson },
      state,
      userPrefix: '/users/123',
      sourceParentName: 'AlphaXiv'
    });

    const created = recorder._state.collections;
    const names = Object.values(created).map(c => c.data.name);
    expect(names).toContain('AlphaXiv');
    expect(names).toContain('My Folder');

    const items = Object.values(recorder._state.items);
    const parent = items.find(i => i.data.itemType === 'journalArticle');
    expect(parent.data.title).toBe('Test Paper');
    const note = items.find(i => i.data.itemType === 'note');
    expect(note.data.note).toContain('mine');

    expect(result.papersWritten).toBe(1);
    expect(result.collectionsTouched).toContain('My Folder');
    expect(state.put).toHaveBeenCalledWith('alphaxiv', '2504.10045', expect.objectContaining({ zoteroKey: expect.any(String) }));
  });

  it('does not duplicate the parent on a second sync', async () => {
    const recorder = makeRecorder();
    const state = makeState();
    await applyToZotero({ adapterResult, client: { fetchJson: recorder.fetchJson }, state, userPrefix: '/users/123', sourceParentName: 'AlphaXiv' });
    const before = Object.keys(recorder._state.collections).length;

    await applyToZotero({ adapterResult, client: { fetchJson: recorder.fetchJson }, state, userPrefix: '/users/123', sourceParentName: 'AlphaXiv' });
    const after = Object.keys(recorder._state.collections).length;

    expect(after).toBe(before); // no new collections created
  });

  it('removes the sync-note when a paper has no personal notes', async () => {
    const recorder = makeRecorder();
    const state = makeState();
    const noNotes = { ...adapterResult, notes: [] };
    await applyToZotero({ adapterResult: noNotes, client: { fetchJson: recorder.fetchJson }, state, userPrefix: '/users/123', sourceParentName: 'AlphaXiv' });

    const items = Object.values(recorder._state.items);
    const note = items.find(i => i.data.itemType === 'note');
    expect(note).toBeUndefined();
  });
});
