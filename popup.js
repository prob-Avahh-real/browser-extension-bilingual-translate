import { TARGET_LANGUAGES, SOURCE_LANGUAGES, DEFAULT_TARGET_LANG } from './lib/languages.js';

const langSelect = document.getElementById('target-lang');
for (const lang of TARGET_LANGUAGES) {
  const opt = document.createElement('option');
  opt.value = lang.code;
  opt.textContent = lang.label;
  langSelect.appendChild(opt);
}

const sourceSelect = document.getElementById('source-lang');
for (const lang of SOURCE_LANGUAGES) {
  const opt = document.createElement('option');
  opt.value = lang.code;
  opt.textContent = lang.label;
  sourceSelect.appendChild(opt);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refresh() {
  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  document.getElementById('enabled').checked = settings.enabled !== false;
  langSelect.value = settings.targetLang || DEFAULT_TARGET_LANG;
  sourceSelect.value = settings.sourceLang || 'auto';

  const tab = await getActiveTab();
  const host = tab?.url ? new URL(tab.url).hostname : '';
  document.getElementById('host').textContent = host ? `当前站点：${host}` : '';

  const blocked = (settings.blockedHosts || []).includes(host);
  document.getElementById('block-host').hidden = blocked;
  document.getElementById('unblock-host').hidden = !blocked;
}

document.getElementById('enabled').addEventListener('change', async (e) => {
  await chrome.runtime.sendMessage({ type: 'SET_ENABLED', enabled: e.target.checked });
});

langSelect.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ type: 'SET_TARGET_LANG', targetLang: langSelect.value });
  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'RUN_NOW' }).catch(() => {});
  }
});

sourceSelect.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ type: 'SET_SOURCE_LANG', sourceLang: sourceSelect.value });
  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'RUN_NOW' }).catch(() => {});
  }
});

document.getElementById('run-now').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'RUN_NOW' }).catch(() => {});
  }
  window.close();
});

document.getElementById('block-host').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.url) return;
  const host = new URL(tab.url).hostname;
  await chrome.runtime.sendMessage({ type: 'BLOCK_HOST', host });
  await refresh();
});

document.getElementById('unblock-host').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.url) return;
  const host = new URL(tab.url).hostname;
  await chrome.runtime.sendMessage({ type: 'UNBLOCK_HOST', host });
  await refresh();
});

refresh();
