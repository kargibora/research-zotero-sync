const fields = ['apiKey', 'userId', 'enableAlphaxiv', 'enableScholarInbox'];
const storeKeyMap = {
  apiKey: 'zoteroApiKey',
  userId: 'zoteroUserId',
  enableAlphaxiv: 'enableAlphaxiv',
  enableScholarInbox: 'enableScholarInbox'
};

function load() {
  chrome.storage.sync.get({
    zoteroApiKey: '', zoteroUserId: '',
    enableAlphaxiv: true, enableScholarInbox: true
  }, settings => {
    document.getElementById('apiKey').value = settings.zoteroApiKey || '';
    document.getElementById('userId').value = settings.zoteroUserId || '';
    document.getElementById('enableAlphaxiv').checked = !!settings.enableAlphaxiv;
    document.getElementById('enableScholarInbox').checked = !!settings.enableScholarInbox;
  });
}

function save() {
  const out = {};
  for (const f of fields) {
    const el = document.getElementById(f);
    out[storeKeyMap[f]] = el.type === 'checkbox' ? el.checked : el.value.trim();
  }
  chrome.storage.sync.set(out, () => {
    const status = document.getElementById('status');
    status.textContent = 'Saved';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
}

document.getElementById('save').addEventListener('click', save);
load();
