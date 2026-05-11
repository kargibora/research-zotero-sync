const $ = sel => document.querySelector(sel);

async function send(message) {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
}

function renderResult(label, response) {
  const el = $('#result');
  if (!response) { el.textContent = `${label}: no response`; return; }
  if (!response.ok) { el.textContent = `${label}: ❌ ${response.error || 'unknown error'}`; return; }
  const r = response.result || {};
  if (r.ok === false) { el.textContent = `${label}: ❌ ${r.error || 'unknown error'}`; return; }
  if (r.papersWritten !== undefined) {
    el.textContent = `${label}: ✅ ${r.papersWritten} papers in ${(r.collectionsTouched || []).length} collections`;
  } else {
    el.textContent = `${label}: ✅`;
  }
}

async function refreshStatus() {
  const status = await send({ type: 'getStatus' });
  if (!status?.ok) return;
  const last = status.result?.lastSync || {};
  $('#alphaxivStatus').textContent = last.alphaxiv ? `last: ${last.alphaxiv.papers} papers · ${new Date(last.alphaxiv.at).toLocaleString()}` : 'never synced';
  $('#scholarInboxStatus').textContent = last['scholar-inbox'] ? `last: ${last['scholar-inbox'].papers} papers · ${new Date(last['scholar-inbox'].at).toLocaleString()}` : 'never synced';
}

$('#syncAlphaxiv').addEventListener('click', async () => {
  $('#result').textContent = 'Syncing AlphaXiv…';
  renderResult('AlphaXiv', await send({ type: 'syncSource', source: 'alphaxiv' }));
  refreshStatus();
});

$('#syncScholarInbox').addEventListener('click', async () => {
  $('#result').textContent = 'Syncing Scholar-Inbox…';
  renderResult('Scholar-Inbox', await send({ type: 'syncSource', source: 'scholar-inbox' }));
  refreshStatus();
});

$('#syncAll').addEventListener('click', async () => {
  $('#result').textContent = 'Syncing all…';
  const a = await send({ type: 'syncSource', source: 'alphaxiv' });
  const s = await send({ type: 'syncSource', source: 'scholar-inbox' });
  const errors = [a, s].filter(r => !r?.ok).map(r => r.error).join('; ');
  $('#result').textContent = errors ? `❌ ${errors}` : `✅ all sources synced`;
  refreshStatus();
});

$('#syncCurrentPage').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  $('#result').textContent = 'Extracting page…';
  let page;
  try {
    page = await chrome.tabs.sendMessage(tab.id, { type: 'extractPageData' });
  } catch (e) {
    if (/Receiving end does not exist|Could not establish connection/i.test(e.message)) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content.js'] });
        page = await chrome.tabs.sendMessage(tab.id, { type: 'extractPageData' });
      } catch (e2) {
        $('#result').textContent = `❌ extract: cannot inject into this tab (${e2.message}). Try refreshing the tab.`;
        return;
      }
    } else {
      $('#result').textContent = `❌ extract: ${e.message}`;
      return;
    }
  }
  if (!page?.ok) { $('#result').textContent = `❌ extract: ${page?.error || 'no response'}`; return; }
  $('#result').textContent = 'Syncing page…';
  renderResult('Page', await send({ type: 'syncCurrentPage', payload: page.data }));
});

$('#openOptions').addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

refreshStatus();
