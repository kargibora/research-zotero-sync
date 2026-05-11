import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAlphaxivAdapter } from '../../src/adapters/alphaxiv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const folders = JSON.parse(readFileSync(join(__dirname, '../fixtures/alphaxiv-folders-v3.json'), 'utf8'));
const comments = JSON.parse(readFileSync(join(__dirname, '../fixtures/alphaxiv-comments.json'), 'utf8'));
const me = JSON.parse(readFileSync(join(__dirname, '../fixtures/alphaxiv-users-v3.json'), 'utf8'));

function makeFetch(routes) {
  return vi.fn(async (url) => {
    for (const [pattern, body] of routes) {
      if (typeof pattern === 'string' ? url === pattern : pattern.test(url)) {
        return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) };
      }
    }
    throw new Error(`unhandled fetch ${url}`);
  });
}

describe('createAlphaxivAdapter().fetchAll', () => {
  it('normalizes folders and papers into AdapterResult shape', async () => {
    const fetchMock = makeFetch([
      ['https://api.alphaxiv.org/users/v3', me],
      ['https://api.alphaxiv.org/folders/v3', folders],
      [/papers\/v3\/legacy\/.+\/comments$/, comments]
    ]);
    const adapter = createAlphaxivAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();

    expect(result.source).toBe('alphaxiv');
    expect(result.user.id).toBe(me.id);
    expect(result.collections).toHaveLength(folders.length);
    const first = result.collections[0];
    expect(first.name).toBe(folders[0].name);
    expect(first.papers[0].arxivId).toBe(folders[0].papers[0].universalPaperId);
    expect(first.papers[0].title).toBe(folders[0].papers[0].title);
    expect(first.papers[0].pdfUrl).toBe(`https://arxiv.org/pdf/${folders[0].papers[0].universalPaperId}`);
    expect(first.papers[0].sourceUrl).toBe(`https://www.alphaxiv.org/abs/${folders[0].papers[0].universalPaperId}`);
  });

  it('classifies default folders correctly', async () => {
    const fetchMock = makeFetch([
      ['https://api.alphaxiv.org/users/v3', me],
      ['https://api.alphaxiv.org/folders/v3', folders],
      [/comments$/, []]
    ]);
    const adapter = createAlphaxivAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();
    for (const col of result.collections) {
      const orig = folders.find(f => f.id === col.sourceId);
      const expected = orig.type === 'custom' ? 'custom' : 'default';
      expect(col.type).toBe(expected);
    }
  });

  it('only keeps personal comments (userId === me.id)', async () => {
    const personalComments = [
      { ...comments[0], userId: me.id, body: 'mine', annotation: null, date: '2026-04-01' },
      { ...comments[0], userId: 'someone-else', body: 'theirs', annotation: null, date: '2026-04-02' }
    ];
    const fetchMock = makeFetch([
      ['https://api.alphaxiv.org/users/v3', me],
      ['https://api.alphaxiv.org/folders/v3', folders],
      [/comments$/, personalComments]
    ]);
    const adapter = createAlphaxivAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();
    expect(result.notes.every(n => n.text === 'mine')).toBe(true);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('sends credentials: include for cookie auth', async () => {
    const fetchMock = makeFetch([
      ['https://api.alphaxiv.org/users/v3', me],
      ['https://api.alphaxiv.org/folders/v3', folders],
      [/comments$/, []]
    ]);
    const adapter = createAlphaxivAdapter({ fetch: fetchMock });
    await adapter.fetchAll();
    for (const call of fetchMock.mock.calls) {
      expect(call[1]?.credentials).toBe('include');
    }
  });
});
