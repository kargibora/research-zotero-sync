const $ = sel => document.querySelector(sel);

async function send(message) {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
}

const SOURCES = {
  'alphaxiv':      { label: 'AlphaXiv',      cardSel: '[data-source="alphaxiv"]',      pillSel: '#alphaxivPill',      statusSel: '#alphaxivStatus',      btnSel: '#syncAlphaxiv' },
  'scholar-inbox': { label: 'Scholar-Inbox', cardSel: '[data-source="scholar-inbox"]', pillSel: '#scholarInboxPill', statusSel: '#scholarInboxStatus', btnSel: '#syncScholarInbox' }
};

function setCardState(source, state) {
  const s = SOURCES[source];
  $(s.cardSel).dataset.state = state;
  const pill = $(s.pillSel);
  pill.className = `pill ${state}`;
  pill.textContent = state;
  const btn = $(s.btnSel);
  btn.disabled = state === 'syncing';
  btn.innerHTML = state === 'syncing'
    ? `<span class="spinner"></span><span class="btn-label">Syncing…</span>`
    : `<span class="btn-label">Sync</span>`;
}

function showResult(text, kind) {
  const el = $('#result');
  el.className = 'result ' + (kind || 'info');
  el.textContent = text;
}

function clearResult() {
  $('#result').className = 'result hidden';
  $('#result').textContent = '';
}

function relative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

async function refreshStatus() {
  const status = await send({ type: 'getStatus' });
  if (!status?.ok) return;
  const last = status.result?.lastSync || {};
  for (const [source, s] of Object.entries(SOURCES)) {
    const ls = last[source];
    $(s.statusSel).textContent = ls ? `${ls.papers} papers · ${relative(ls.at)}` : 'never synced';
  }
}

async function syncOne(source) {
  const s = SOURCES[source];
  setCardState(source, 'syncing');
  showResult(`Syncing ${s.label}…`, 'info');

  const response = await send({ type: 'syncSource', source });

  if (!response?.ok) {
    setCardState(source, 'error');
    showResult(`${s.label}: ${response?.error || 'unknown error'}`, 'error');
    return false;
  }
  const r = response.result;
  if (r?.ok === false) {
    setCardState(source, 'error');
    showResult(`${s.label}: ${r.error || 'unknown error'}`, 'error');
    return false;
  }

  setCardState(source, 'success');
  const papers = r?.papersWritten ?? 0;
  const cols = (r?.collectionsTouched || []).length;
  showResult(`${s.label}: ${papers} paper${papers === 1 ? '' : 's'} in ${cols} collection${cols === 1 ? '' : 's'}`, 'success');
  await refreshStatus();
  return true;
}

$('#syncAlphaxiv').addEventListener('click', () => syncOne('alphaxiv'));
$('#syncScholarInbox').addEventListener('click', () => syncOne('scholar-inbox'));

$('#syncAll').addEventListener('click', async () => {
  clearResult();
  const a = await syncOne('alphaxiv');
  const s = await syncOne('scholar-inbox');
  if (a && s) showResult('All sources synced.', 'success');
});

$('#syncCurrentPage').addEventListener('click', async () => {
  clearResult();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  showResult('Extracting page…', 'info');
  let page;
  try {
    page = await chrome.tabs.sendMessage(tab.id, { type: 'extractPageData' });
  } catch (e) {
    if (/Receiving end does not exist|Could not establish connection/i.test(e.message)) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content.js'] });
        page = await chrome.tabs.sendMessage(tab.id, { type: 'extractPageData' });
      } catch (e2) {
        showResult(`Extract failed: ${e2.message}. Try refreshing the tab.`, 'error');
        return;
      }
    } else {
      showResult(`Extract failed: ${e.message}`, 'error');
      return;
    }
  }
  if (!page?.ok) { showResult(`Extract failed: ${page?.error || 'no response'}`, 'error'); return; }
  showResult('Syncing page to Zotero…', 'info');
  const response = await send({ type: 'syncCurrentPage', payload: page.data });
  if (!response?.ok) { showResult(`Page sync failed: ${response?.error || 'unknown error'}`, 'error'); return; }
  const r = response.result;
  if (r?.ok === false) { showResult(`Page sync failed: ${r.error || 'unknown error'}`, 'error'); return; }
  const papers = r?.papersWritten ?? 0;
  showResult(`Page synced — ${papers} paper added to Zotero.`, 'success');
});

$('#openOptions').addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

refreshStatus();
