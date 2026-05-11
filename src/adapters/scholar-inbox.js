const API_BASE = 'https://api.scholar-inbox.com';

export function createScholarInboxAdapter({ fetch }) {
  if (!fetch) throw new Error('createScholarInboxAdapter: fetch required');

  async function request(method, path, body) {
    const init = {
      method,
      credentials: 'include',
      headers: { accept: 'application/json' }
    };
    if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${path}`, init);
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not logged in to Scholar-Inbox. Open https://www.scholar-inbox.com in another tab and sign in, then retry.');
    }
    if (!res.ok) throw new Error(`Scholar-Inbox ${path} → HTTP ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchAll() {
    const list = await request('GET', '/api/get_all_user_collections');
    const ownerCollections = (list?.collections || []).filter(c => c.permission === 'owner');

    if (ownerCollections.length === 0) {
      return { source: 'scholar-inbox', fetchedAt: new Date().toISOString(), user: { id: '' }, collections: [], notes: [] };
    }

    const detail = await request('POST', '/api/get_collections', { collection_ids: ownerCollections.map(c => c.id) });
    const detailMap = new Map((detail?.collections || []).map(c => [c.id, c]));

    const collections = ownerCollections.map(meta => {
      const full = detailMap.get(meta.id) || {};
      return {
        sourceId: String(meta.id),
        name: meta.name,
        type: 'custom',
        papers: (full.papers || []).map(normalizePaper)
      };
    });

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

function normalizePaper(p) {
  const arxivId = (p.arxiv_id || '').trim();
  const cacheStem = (p.cache_file_name || '').replace(/\.pdf$/i, '');
  return {
    sourceId: arxivId || String(p.paper_id),
    arxivId,
    doi: '',
    title: p.title || '',
    abstract: p.abstract || '',
    authors: (p.authors || '').split(',').map(s => s.trim()).filter(Boolean),
    date: p.publication_date || '',
    pdfUrl: arxivId ? `https://arxiv.org/pdf/${arxivId}` : '',
    addedAt: '',
    sourceUrl: cacheStem ? `https://www.scholar-inbox.com/paper/${cacheStem}` : ''
  };
}
