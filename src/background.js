import { createZoteroClient } from './zotero/client.js';
import { applyToZotero } from './zotero/sync.js';
import { createAlphaxivAdapter } from './adapters/alphaxiv.js';
import { createScholarInboxAdapter } from './adapters/scholar-inbox.js';
import { createSyncState } from './sync/state.js';
import { runSync } from './sync/orchestrator.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message)
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: error.message, stack: error.stack }));
  return true;
});

async function handle(message) {
  if (message?.type === 'syncSource') return syncSource(message.source);
  if (message?.type === 'syncCurrentPage') return syncCurrentPage(message.payload);
  if (message?.type === 'getStatus') return getStatus();
  throw new Error(`Unknown message type: ${message?.type}`);
}

async function getSettings() {
  const settings = await chrome.storage.sync.get({
    zoteroApiKey: '', zoteroUserId: '',
    enableAlphaxiv: true, enableScholarInbox: true,
    lastSync: {}
  });
  if (!settings.zoteroApiKey) throw new Error('Missing Zotero API key. Open the extension Options to set one.');
  return settings;
}

async function getClientAndPrefix(settings) {
  const client = createZoteroClient({ apiKey: settings.zoteroApiKey, fetch: globalThis.fetch.bind(globalThis) });
  let userId = settings.zoteroUserId;
  if (!userId) {
    const keyInfo = await client.fetchJson(`/keys/${settings.zoteroApiKey}`);
    userId = String(keyInfo?.userID || '');
    if (!userId) throw new Error('Could not infer Zotero user ID from API key. Set it manually in Options.');
    await chrome.storage.sync.set({ zoteroUserId: userId });
  }
  return { client, userPrefix: `/users/${userId}` };
}

function makeAdapter(source) {
  const fetchFn = globalThis.fetch.bind(globalThis);
  if (source === 'alphaxiv') return createAlphaxivAdapter({ fetch: fetchFn });
  if (source === 'scholar-inbox') return createScholarInboxAdapter({ fetch: fetchFn });
  throw new Error(`Unknown source: ${source}`);
}

async function syncSource(source) {
  const settings = await getSettings();
  const { client, userPrefix } = await getClientAndPrefix(settings);
  const state = createSyncState({ storage: chrome.storage.local });
  const adapter = makeAdapter(source);

  const result = await runSync({
    source,
    adapter,
    apply: async ({ adapterResult, sourceParentName, userPrefix: up }) =>
      applyToZotero({ adapterResult, client, state, userPrefix: up, sourceParentName }),
    userPrefix
  });

  if (result.ok) {
    const lastSync = { ...(settings.lastSync || {}), [source]: { at: new Date().toISOString(), papers: result.papersWritten, collections: result.collectionsTouched.length } };
    await chrome.storage.sync.set({ lastSync });
  }
  return result;
}

async function syncCurrentPage(pageData) {
  // Preserve the existing per-page flow by feeding it through the new sync module.
  if (!pageData) throw new Error('No page data received.');
  if (!pageData.title && !pageData.identifiers?.arxiv) throw new Error('Could not detect a paper title or arXiv ID on this page.');

  const settings = await getSettings();
  const { client, userPrefix } = await getClientAndPrefix(settings);
  const state = createSyncState({ storage: chrome.storage.local });

  const adapterResult = {
    source: pageData.source || 'page',
    fetchedAt: new Date().toISOString(),
    user: { id: '' },
    collections: [{
      sourceId: 'manual',
      name: pageData.source === 'alphaxiv' ? 'AlphaXiv (per-page)' : 'Scholar-Inbox (per-page)',
      type: 'custom',
      papers: [{
        sourceId: pageData.identifiers?.arxiv || pageData.identifiers?.doi || pageData.url,
        arxivId: pageData.identifiers?.arxiv || '',
        doi: pageData.identifiers?.doi || '',
        title: pageData.title || `arXiv:${pageData.identifiers?.arxiv || ''}`,
        abstract: pageData.abstract || '',
        authors: pageData.authors || [],
        date: pageData.date || '',
        pdfUrl: pageData.pdfUrl || '',
        addedAt: '',
        sourceUrl: pageData.url || ''
      }]
    }],
    notes: (pageData.comments || []).map(c => ({
      paperSourceId: pageData.identifiers?.arxiv || pageData.identifiers?.doi || pageData.url,
      kind: 'comment',
      text: c.text || '',
      anchor: c.anchor || '',
      createdAt: c.createdAt || ''
    }))
  };

  const sourceParentName = pageData.source === 'alphaxiv' ? 'AlphaXiv'
    : pageData.source === 'scholar-inbox' ? 'Scholar-Inbox'
    : 'Manual sync';

  return applyToZotero({ adapterResult, client, state, userPrefix, sourceParentName });
}

async function getStatus() {
  const settings = await chrome.storage.sync.get({ enableAlphaxiv: true, enableScholarInbox: true, lastSync: {} });
  return settings;
}
