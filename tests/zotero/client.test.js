import { describe, it, expect, vi } from 'vitest';
import { createZoteroClient } from '../../src/zotero/client.js';

describe('createZoteroClient', () => {
  it('sends Zotero-API-Key and Zotero-API-Version headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers({ 'Last-Modified-Version': '42' }),
      text: async () => '{"hello":"world"}'
    });
    const client = createZoteroClient({ apiKey: 'KEY123', fetch: fetchMock });

    const result = await client.fetchJson('/users/1/items?limit=1');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.zotero.org/users/1/items?limit=1');
    expect(init.headers.get('Zotero-API-Key')).toBe('KEY123');
    expect(init.headers.get('Zotero-API-Version')).toBe('3');
    expect(result.data).toEqual({ hello: 'world' });
    expect(result.libraryVersion).toBe('42');
  });

  it('throws on non-ok responses with the API error body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 403,
      headers: new Headers(),
      text: async () => 'Forbidden'
    });
    const client = createZoteroClient({ apiKey: 'K', fetch: fetchMock });

    await expect(client.fetchJson('/users/1/items')).rejects.toThrow(/Zotero API 403.*Forbidden/);
  });

  it('returns null body on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 204, headers: new Headers(), text: async () => ''
    });
    const client = createZoteroClient({ apiKey: 'K', fetch: fetchMock });

    const result = await client.fetchJson('/users/1/items/X', { method: 'DELETE' });
    expect(result).toBeNull();
  });
});
