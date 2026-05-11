const API_BASE = 'https://api.scholar-inbox.com';

export function createScholarInboxAdapter({ fetch }) {
  if (!fetch) throw new Error('createScholarInboxAdapter: fetch required');

  async function getJson(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not logged in to Scholar-Inbox. Open https://www.scholar-inbox.com in another tab and sign in, then retry.');
    }
    if (!res.ok) throw new Error(`Scholar-Inbox ${path} → HTTP ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchAll() {
    const resp = await getJson('/api/get_all_user_collections');
    const collections = (resp?.collections || [])
      .filter(c => c.permission === 'owner')
      .map(c => ({
        sourceId: String(c.id),
        name: c.name,
        type: 'custom',
        papers: []
      }));

    return {
      source: 'scholar-inbox',
      fetchedAt: new Date().toISOString(),
      user: { id: '' },
      collections,
      notes: []
    };
  }

  return { fetchAll };
}
