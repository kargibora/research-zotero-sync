import { renderNoteHtml } from './note-render.js';

export async function applyToZotero({ adapterResult, client, state, userPrefix, sourceParentName }) {
  const parentKey = await ensureCollection(client, userPrefix, sourceParentName, null);
  const collectionsTouched = [];
  const errors = [];
  let papersWritten = 0;

  for (const col of adapterResult.collections) {
    const childKey = await ensureCollection(client, userPrefix, col.name, parentKey);
    collectionsTouched.push(col.name);
    if (col.papers.length === 0) continue;

    for (const paper of col.papers) {
      try {
        const itemKey = await upsertItem({ client, userPrefix, paper, state, source: adapterResult.source });
        await ensureItemInCollection(client, userPrefix, itemKey, childKey);

        const paperNotes = adapterResult.notes.filter(n => n.paperSourceId === paper.sourceId);
        const marker = `research-sync:${adapterResult.source}-comments`;
        await reconcileSyncNote({ client, userPrefix, parentKey: itemKey, paper, notes: paperNotes, marker });
        papersWritten += 1;
      } catch (e) {
        errors.push({ paper: paper.sourceId, error: e.message });
      }
    }
  }

  return { source: adapterResult.source, papersWritten, collectionsTouched, errors };
}

async function ensureCollection(client, prefix, name, parentCollection) {
  const existing = await client.fetchJson(`${prefix}/collections?limit=100&format=json`);
  const found = (existing || []).find(c =>
    c?.data?.name === name &&
    ((parentCollection || false) === (c?.data?.parentCollection || false))
  );
  if (found) return found.key;

  const result = await client.fetchJson(`${prefix}/collections`, {
    method: 'POST',
    headers: { 'Zotero-Write-Token': cryptoRandom() },
    body: JSON.stringify([{ name, parentCollection: parentCollection || false }])
  });
  const key = result?.success?.['0'];
  if (!key) throw new Error(`Failed to create collection ${name}: ${JSON.stringify(result)}`);
  return key;
}

async function upsertItem({ client, userPrefix, paper, state, source }) {
  const indexed = await state.get(source, paper.sourceId);
  if (indexed?.zoteroKey) return indexed.zoteroKey;

  const found = await findExisting(client, userPrefix, paper);
  if (found) {
    await state.put(source, paper.sourceId, { zoteroKey: found.key, hash: state.hashPaper(paper) });
    return found.key;
  }

  const item = {
    itemType: 'journalArticle',
    title: paper.title || `arXiv:${paper.arxivId || ''}`,
    creators: paper.authors.map(authorToCreator),
    abstractNote: paper.abstract || '',
    date: paper.date || '',
    DOI: paper.doi || '',
    url: paper.sourceUrl || paper.pdfUrl || '',
    archive: paper.arxivId ? 'arXiv' : '',
    archiveLocation: paper.arxivId || '',
    tags: [
      { tag: `synced:${source}` },
      paper.arxivId ? { tag: `arxiv:${paper.arxivId}` } : null,
      paper.doi ? { tag: `doi:${paper.doi}` } : null
    ].filter(Boolean)
  };

  const result = await client.fetchJson(`${userPrefix}/items`, {
    method: 'POST',
    headers: { 'Zotero-Write-Token': cryptoRandom() },
    body: JSON.stringify([item])
  });
  const key = result?.success?.['0'];
  if (!key) throw new Error(`Failed to create item ${paper.title}: ${JSON.stringify(result)}`);
  await state.put(source, paper.sourceId, { zoteroKey: key, hash: state.hashPaper(paper) });
  return key;
}

async function findExisting(client, prefix, paper) {
  const queries = [paper.doi, paper.arxivId, paper.title?.slice(0, 120)].filter(Boolean);
  for (const q of queries) {
    const params = new URLSearchParams({ q, limit: '10', format: 'json' });
    const items = await client.fetchJson(`${prefix}/items?${params}`);
    const match = (items || []).find(i => i.data?.itemType !== 'attachment' && i.data?.itemType !== 'note' && matchesPaper(i.data, paper));
    if (match) return match;
  }
  return null;
}

function matchesPaper(itemData, paper) {
  const hay = JSON.stringify(itemData).toLowerCase();
  if (paper.doi && hay.includes(paper.doi.toLowerCase())) return true;
  if (paper.arxivId && hay.includes(paper.arxivId.toLowerCase().replace(/^arxiv:/, ''))) return true;
  if (paper.title && itemData.title && norm(paper.title) === norm(itemData.title)) return true;
  return false;
}

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

async function ensureItemInCollection(client, prefix, itemKey, collectionKey) {
  const item = await client.fetchJson(`${prefix}/items/${itemKey}`);
  const data = item?.data || item;
  const cols = new Set(data.collections || []);
  if (cols.has(collectionKey)) return;
  cols.add(collectionKey);
  await client.fetchJson(`${prefix}/items/${itemKey}`, {
    method: 'PATCH',
    body: JSON.stringify({ collections: Array.from(cols), version: item.version || data.version })
  });
}

async function reconcileSyncNote({ client, userPrefix, parentKey, paper, notes, marker }) {
  const children = await client.fetchJson(`${userPrefix}/items/${parentKey}/children?format=json&limit=100`);
  const existing = (children || []).find(c => c.data?.itemType === 'note' && c.data?.note?.includes(marker));

  if (notes.length === 0) {
    if (existing) {
      await client.fetchJson(`${userPrefix}/items/${existing.key}`, { method: 'DELETE', headers: { 'If-Unmodified-Since-Version': String(existing.version) } });
    }
    return;
  }

  const noteHtml = renderNoteHtml(paper, notes, marker);
  if (existing) {
    await client.fetchJson(`${userPrefix}/items/${existing.key}`, {
      method: 'PATCH',
      body: JSON.stringify({ note: noteHtml, version: existing.version })
    });
  } else {
    await client.fetchJson(`${userPrefix}/items`, {
      method: 'POST',
      headers: { 'Zotero-Write-Token': cryptoRandom() },
      body: JSON.stringify([{ itemType: 'note', parentItem: parentKey, note: noteHtml }])
    });
  }
}

function authorToCreator(name) {
  const clean = String(name || '').trim();
  if (!clean) return { creatorType: 'author', name: '' };
  if (clean.includes(',')) {
    const [last, ...rest] = clean.split(',');
    return { creatorType: 'author', firstName: rest.join(',').trim(), lastName: last.trim() };
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { creatorType: 'author', lastName: clean };
  return { creatorType: 'author', firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) };
}

function cryptoRandom() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return `wt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 32);
}
