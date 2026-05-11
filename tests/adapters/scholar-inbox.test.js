import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createScholarInboxAdapter } from '../../src/adapters/scholar-inbox.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const collectionsResp = JSON.parse(readFileSync(join(__dirname, '../fixtures/scholar-inbox-collections.json'), 'utf8'));

describe('createScholarInboxAdapter().fetchAll', () => {
  it('keeps owner collections and drops viewer collections', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200, headers: new Headers(),
      text: async () => JSON.stringify(collectionsResp)
    }));
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });

    const result = await adapter.fetchAll();

    const ownerNames = collectionsResp.collections.filter(c => c.permission === 'owner').map(c => c.name);
    const resultNames = result.collections.map(c => c.name);
    expect(resultNames.sort()).toEqual(ownerNames.sort());
    expect(result.collections.every(c => c.papers.length === 0)).toBe(true);
  });

  it('throws a useful auth message on 401', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 401, headers: new Headers(), text: async () => 'unauth'
    }));
    const adapter = createScholarInboxAdapter({ fetch: fetchMock });
    await expect(adapter.fetchAll()).rejects.toThrow(/Not logged in to Scholar-Inbox/i);
  });
});
