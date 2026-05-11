const API_BASE = 'https://api.alphaxiv.org';

export function createAlphaxivAdapter({ fetch }) {
  if (!fetch) throw new Error('createAlphaxivAdapter: fetch required');

  async function getJson(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not logged in to AlphaXiv. Open https://www.alphaxiv.org in another tab and sign in, then retry.');
    }
    if (!res.ok) throw new Error(`AlphaXiv ${path} → HTTP ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchAll() {
    const me = await getJson('/users/v3');
    const folders = await getJson('/folders/v3');

    const collections = folders.map(f => ({
      sourceId: f.id,
      name: f.name,
      type: f.type === 'custom' ? 'custom' : 'default',
      papers: (f.papers || []).map(normalizePaper)
    }));

    const notes = [];
    const seenPaperGroupIds = new Set();
    for (const f of folders) {
      for (const p of f.papers || []) {
        if (seenPaperGroupIds.has(p.paperGroupId)) continue;
        seenPaperGroupIds.add(p.paperGroupId);
        const comments = await getJson(`/papers/v3/legacy/${p.paperGroupId}/comments`);
        for (const c of comments || []) {
          if (c.userId !== me.id) continue;
          if (c.body) {
            notes.push({
              paperSourceId: p.universalPaperId,
              kind: 'comment',
              text: c.body,
              createdAt: c.date || ''
            });
          }
          if (c.annotation) {
            notes.push({
              paperSourceId: p.universalPaperId,
              kind: 'highlight',
              text: typeof c.annotation === 'string' ? c.annotation : JSON.stringify(c.annotation),
              createdAt: c.date || ''
            });
          }
        }
      }
    }

    return {
      source: 'alphaxiv',
      fetchedAt: new Date().toISOString(),
      user: { id: me.id },
      collections,
      notes
    };
  }

  return { fetchAll };
}

function normalizePaper(p) {
  return {
    sourceId: p.universalPaperId,
    arxivId: p.universalPaperId,
    doi: '',
    title: p.title || '',
    abstract: p.abstract || '',
    authors: (p.authors || []).map(a => a.full_name || '').filter(Boolean),
    date: p.publicationDate || '',
    pdfUrl: p.universalPaperId ? `https://arxiv.org/pdf/${p.universalPaperId}` : '',
    addedAt: p.addedAt || '',
    sourceUrl: p.universalPaperId ? `https://www.alphaxiv.org/abs/${p.universalPaperId}` : ''
  };
}
