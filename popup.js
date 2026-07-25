async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refresh() {
  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  document.getElementById('enabled').checked = settings.enabled !== false;

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
