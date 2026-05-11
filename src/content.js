function detectSource() {
  const host = location.hostname;
  if (host.includes('alphaxiv')) return 'alphaxiv';
  if (host.includes('scholar-inbox')) return 'scholar-inbox';
  return 'unknown';
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'extractPageData') {
    try { sendResponse({ ok: true, data: extractPageData() }); }
    catch (error) { sendResponse({ ok: false, error: error.message }); }
    return true;
  }
  if (message?.type === 'proxyFetch') {
    proxyFetch(message.url, message.init)
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return true;
});

async function proxyFetch(url, init = {}) {
  const res = await fetch(url, {
    method: init.method || 'GET',
    credentials: 'include',
    headers: init.headers || { accept: 'application/json' },
    body: init.body
  });
  const body = await res.text();
  return { status: res.status, ok: res.ok, body };
}

function extractPageData() {
  const source = detectSource();

  // Best integration point for Scholar Inbox: define this in your app and keep the extension dumb/stable.
  if (source === 'scholar-inbox' && typeof window.__SCHOLAR_INBOX_ZOTERO_EXPORT__ === 'function') {
    const exported = window.__SCHOLAR_INBOX_ZOTERO_EXPORT__();
    return normalizeExport({ ...exported, source, url: location.href });
  }

  return normalizeExport({
    source,
    url: location.href,
    title: getMeta('citation_title') || getMeta('og:title') || document.title,
    authors: getMetaAll('citation_author'),
    abstract: getMeta('description') || getText(['[data-testid="abstract"]', '.abstract', '[class*="abstract"]']),
    date: getMeta('citation_publication_date') || getMeta('citation_date'),
    identifiers: {
      arxiv: detectArxivId(),
      doi: getMeta('citation_doi') || detectDoi()
    },
    pdfUrl: getMeta('citation_pdf_url') || detectPdfUrl(),
    comments: extractVisibleNotesAndComments(source)
  });
}

function normalizeExport(data) {
  const arxiv = data.identifiers?.arxiv || detectArxivIdFromText(`${data.url || ''} ${data.title || ''}`);
  const pdfUrl = data.pdfUrl || (arxiv ? `https://arxiv.org/pdf/${arxiv}` : '');
  return {
    source: data.source || detectSource(),
    url: data.url || location.href,
    title: clean(data.title),
    authors: Array.from(new Set((data.authors || []).map(clean).filter(Boolean))),
    abstract: clean(data.abstract),
    date: clean(data.date),
    identifiers: { arxiv, doi: clean(data.identifiers?.doi || '') },
    pdfUrl,
    comments: (data.comments || []).map(c => ({
      kind: clean(c.kind || 'note'),
      author: clean(c.author || ''),
      createdAt: clean(c.createdAt || ''),
      anchor: clean(c.anchor || ''),
      text: clean(c.text || '')
    })).filter(c => c.text)
  };
}

function getMeta(name) {
  return document.querySelector(`meta[name="${CSS.escape(name)}"], meta[property="${CSS.escape(name)}"]`)?.content || '';
}
function getMetaAll(name) {
  return Array.from(document.querySelectorAll(`meta[name="${CSS.escape(name)}"], meta[property="${CSS.escape(name)}"]`)).map(m => m.content);
}
function getText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.innerText) return el.innerText;
  }
  return '';
}
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function detectArxivId() {
  const fromUrl = detectArxivIdFromText(location.href);
  if (fromUrl) return fromUrl;
  const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
  const fromCanonical = detectArxivIdFromText(canonical);
  if (fromCanonical) return fromCanonical;
  return detectArxivIdFromText(document.body.innerText.slice(0, 5000));
}
function detectArxivIdFromText(text) {
  const m = String(text).match(/(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/|overview\/)?(\d{4}\.\d{4,5})(v\d+)?/i)
    || String(text).match(/(?:arxiv:|arxiv\.org\/(?:abs|pdf)\/)?([a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i);
  return m ? `${m[1]}${m[2] || ''}` : '';
}
function detectDoi() {
  const m = document.body.innerText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return m ? m[0] : '';
}
function detectPdfUrl() {
  const link = Array.from(document.querySelectorAll('a[href]')).find(a => /\.pdf($|[?#])|arxiv\.org\/pdf\//i.test(a.href));
  if (link) return link.href;
  const arxiv = detectArxivId();
  return arxiv ? `https://arxiv.org/pdf/${arxiv}` : '';
}

function extractVisibleNotesAndComments(source) {
  const selector = [
    '[data-testid*="comment" i]', '[data-testid*="note" i]', '[data-testid*="annotation" i]',
    '[class*="comment" i]', '[class*="note" i]', '[class*="annotation" i]',
    '[aria-label*="comment" i]', '[aria-label*="note" i]'
  ].join(',');

  const candidates = Array.from(document.querySelectorAll(selector))
    .filter(el => isVisible(el) && clean(el.innerText).length >= 10)
    .slice(0, 200);

  const dedup = new Map();
  for (const el of candidates) {
    const text = clean(el.innerText);
    if (text.length < 10 || text.length > 5000) continue;
    const key = text.slice(0, 200);
    if (!dedup.has(key)) dedup.set(key, { kind: source === 'alphaxiv' ? 'alphaXiv visible note/comment' : 'visible note/comment', text });
  }
  return Array.from(dedup.values());
}

function isVisible(el) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
}
