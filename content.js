(() => {
  const MAX_SEGMENTS = 600;
  const MAX_UI = 260;
  const DEBOUNCE_MS = 400;

  let running = false;
  let debounceTimer = null;
  let pageDisabled = false;
  let observer = null;
  let historyPatched = false;
  let lastRunAt = 0;

  function isSkippableUrl(url) {
    if (!url) return true;
    const u = url.toLowerCase();
    return (
      u === 'about:blank'
      || u.startsWith('chrome://')
      || u.startsWith('chrome-extension://')
      || u.startsWith('edge://')
      || u.startsWith('moz-extension://')
    );
  }

  async function getSettings() {
    return chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  }

  function hostBlocked(settings) {
    return (settings.blockedHosts || []).includes(location.hostname);
  }

  async function translateTexts(texts, fast) {
    const res = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_BATCH',
      texts,
      fast,
    });
    if (!res?.ok) throw new Error(res?.error || 'translate failed');
    return res.results;
  }

  async function runBilingualize(reason) {
    if (running || pageDisabled) return;
    if (isSkippableUrl(location.href)) return;
    if (reason === 'mutation' && document.getElementById('bilingual-toolbar') && Date.now() - lastRunAt < 2500) {
      return;
    }

    const settings = await getSettings();
    if (!settings.enabled || hostBlocked(settings)) return;
    if (!BilingualLib.isEnglishPage()) return;

    running = true;
    lastRunAt = Date.now();
    try {
      BilingualLib.showToolbar('正在识别并翻译…', {
        onClose: () => {
          pageDisabled = true;
          BilingualLib.teardownBilingual();
        },
      });

      const collected = BilingualLib.collectSegments({
        max: MAX_SEGMENTS,
        maxUi: MAX_UI,
        reset: true,
      });

      if (!collected.texts.length) {
        BilingualLib.updateToolbar('未检测到英文段落');
        return;
      }

      BilingualLib.updateToolbar(`翻译中 ${collected.total} 段…`);
      const translations = await translateTexts(collected.texts, reason !== 'initial');
      const applied = BilingualLib.applyTranslations({
        translations,
        pageUrl: location.href,
      });

      BilingualLib.updateToolbar(
        `已译 ${applied.ok} · 跳过 ${applied.skipped} · ${location.hostname}`,
      );
    } catch (err) {
      BilingualLib.updateToolbar(`翻译失败: ${err.message || err}`);
      console.error('[bilingual-translate]', err);
    } finally {
      running = false;
    }
  }

  function schedule(reason) {
    clearTimeout(debounceTimer);
    const delay = reason === 'initial' ? 300 : DEBOUNCE_MS;
    debounceTimer = setTimeout(() => runBilingualize(reason), delay);
  }

  function patchHistory() {
    if (historyPatched) return;
    historyPatched = true;

    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = (...args) => {
      origPush(...args);
      pageDisabled = false;
      schedule('spa-push');
    };
    history.replaceState = (...args) => {
      origReplace(...args);
      pageDisabled = false;
      schedule('spa-replace');
    };
    window.addEventListener('popstate', () => {
      pageDisabled = false;
      schedule('spa-pop');
    });
  }

  function watchDom() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      if (pageDisabled || running) return;
      schedule('mutation');
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'RUN_NOW') {
      pageDisabled = false;
      schedule('manual');
    }
    if (msg.type === 'TEARDOWN') {
      pageDisabled = true;
      BilingualLib.teardownBilingual();
    }
  });

  patchHistory();
  schedule('initial');
  if (document.body) watchDom();
  else window.addEventListener('DOMContentLoaded', watchDom);
})();
