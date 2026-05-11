const ZOTERO_BASE = 'https://api.zotero.org';
const API_VERSION = '3';

export function createZoteroClient({ apiKey, fetch }) {
  if (!apiKey) throw new Error('createZoteroClient: apiKey required');
  if (!fetch) throw new Error('createZoteroClient: fetch required');

  async function fetchJson(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Zotero-API-Version', API_VERSION);
    headers.set('Zotero-API-Key', apiKey);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`${ZOTERO_BASE}${path}`, { ...options, headers });
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const detail = typeof data === 'string' ? data : JSON.stringify(data);
      throw new Error(`Zotero API ${res.status}: ${detail}`);
    }
    const lastModified = res.headers.get('Last-Modified-Version');
    return lastModified ? { data, libraryVersion: lastModified } : data;
  }

  return { fetchJson };
}
