import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createScholarInboxAdapter } from '../../src/adapters/scholar-inbox.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const collectionsResp = JSON.parse(readFileSync(join(__dirname, '../fixtures/scholar-inbox-collections.json'), 'utf8'));
const detailResp = JSON.parse(readFileSync(join(__dirname, '../fixtures/scholar-inbox-get-collections.json'), 'utf8'));

function makeFetch(routes) {
  return vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET';
    for (const [pattern, handler] of routes) {
      if (typeof pattern === 'string' ? url === pattern : pattern.test(url)) {
        const body = typeof handler === 'function' ? handler(init) : handler;
        return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) };
      }
    }
    throw new Error(`unhandled fetch ${method} ${url}`);
  });
}

describe('createScholarInboxAdapter().fetchAll', () => {
  it('keeps owner collections, fetches papers via get_collections, drops viewer collections', async () => {
    const fetchMock = makeFetch([
      ['https://api.scholar-inbox.com/api/get_all_user_collections', collectionsResp],
      ['https://api.scholar-inbox.com/api/get_collections', detailResp]
    ]);
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();

    const ownerNames = collectionsResp.collections.filter(c => c.permission === 'owner').map(c => c.name);
    const resultNames = result.collections.map(c => c.name);
    expect(resultNames.sort()).toEqual(ownerNames.sort());

    const llmJudge = result.collections.find(c => c.name === 'LLM-as-a-Judge');
    expect(llmJudge.papers).toHaveLength(2);
    expect(llmJudge.papers[0].arxivId).toBe('2306.05685');
    expect(llmJudge.papers[0].pdfUrl).toBe('https://arxiv.org/pdf/2306.05685');
    expect(llmJudge.papers[0].sourceUrl).toBe('https://www.scholar-inbox.com/paper/Zheng2023NeurIPS_Judging_LLM_as_a');
    expect(llmJudge.papers[0].authors).toEqual(['Lianmin Zheng', 'Wei-Lin Chiang', 'Ying Sheng']);
  });

  it('falls back to paper_id as sourceId when arxiv_id missing', async () => {
    const fetchMock = makeFetch([
      ['https://api.scholar-inbox.com/api/get_all_user_collections', collectionsResp],
      ['https://api.scholar-inbox.com/api/get_collections', detailResp]
    ]);
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();
    const llmJudge = result.collections.find(c => c.name === 'LLM-as-a-Judge');
    const noArxiv = llmJudge.papers[1];
    expect(noArxiv.arxivId).toBe('');
    expect(noArxiv.sourceId).toBe('600001');
    expect(noArxiv.pdfUrl).toBe('');
    expect(noArxiv.sourceUrl).toBe('https://www.scholar-inbox.com/paper/NoArxiv2026_Paper_Without');
  });

  it('sends collection_ids as a plural array in the POST body', async () => {
    const captured = [];
    const fetchMock = vi.fn(async (url, init = {}) => {
      captured.push({ url, method: init.method || 'GET', body: init.body });
      const respBody = url.endsWith('/api/get_all_user_collections') ? collectionsResp : detailResp;
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(respBody) };
    });
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });

    await adapter.fetchAll();
    const post = captured.find(c => c.method === 'POST');
    expect(post).toBeTruthy();
    expect(JSON.parse(post.body)).toEqual({ collection_ids: expect.arrayContaining([160972, 160975, 172826, 167704, 160974]) });
  });

  it('skips the second call entirely if no owner collections exist', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, headers: new Headers(),
      text: async () => JSON.stringify({ success: true, collections: [] })
    }));
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();
    expect(result.collections).toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws a useful auth message on 401', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 401, headers: new Headers(), text: async () => 'unauth'
    }));
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });
    await expect(adapter.fetchAll()).rejects.toThrow(/Not logged in to Scholar-Inbox/i);
  });
});
