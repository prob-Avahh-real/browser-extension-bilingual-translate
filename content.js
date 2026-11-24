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
  let pendingTargetChange = false;

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

  async function translateTexts(texts, fast, sourceLang, targetLang) {
    const res = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_BATCH',
      texts,
      fast,
      sourceLang,
      targetLang,
    });
    if (!res?.ok) throw new Error(res?.error || 'translate failed');
    return res.results;
  }

  async function setTargetLang(code) {
    try {
      await chrome.runtime.sendMessage({ type: 'SET_TARGET_LANG', targetLang: code });
    } catch {
      /* ignore */
    }
  }

  async function runBilingualize(reason) {
    if (running || pageDisabled) return;
    if (isSkippableUrl(location.href)) return;
    if (reason === 'mutation' && document.getElementById('bilingual-toolbar') && Date.now() - lastRunAt < 2500) {
      return;
    }

    const settings = await getSettings();
    if (!settings.enabled || hostBlocked(settings)) return;

    const pageLang = BilingualLib.detectPageLang?.() || null;
    if (!pageLang) return;
    const configured = settings.sourceLang && settings.sourceLang !== 'auto'
      ? settings.sourceLang
      : pageLang;
    const targetLang = settings.targetLang || 'zh-Hans';
    const targetLabel = settings.targetLabel || '';
    if (configured === targetLang) {
      BilingualLib.showToolbar(`源语言与目标语言相同（${targetLabel || targetLang}），已跳过`, {
        onClose: () => BilingualLib.teardownBilingual(),
      });
      setTimeout(() => BilingualLib.teardownBilingual(), 2500);
      return;
    }
    const sourceLang = configured;

    running = true;
    lastRunAt = Date.now();
    try {
      BilingualLib.showToolbar('正在识别并翻译…', {
        target: targetLang,
        languages: settings.languages || null,
        onTargetChange: (code) => {
          pendingTargetChange = true;
          setTargetLang(code).finally(() => {
            pageDisabled = false;
            schedule('manual');
          });
        },
        onClose: () => {
          pageDisabled = true;
          BilingualLib.teardownBilingual();
        },
      });

      const collected = BilingualLib.collectSegments({
        max: MAX_SEGMENTS,
        maxUi: MAX_UI,
        reset: true,
        source: sourceLang,
      });

      if (!collected.texts.length) {
        BilingualLib.updateToolbar('未检测到可翻译段落');
        return;
      }

      BilingualLib.updateToolbar(`翻译中 ${collected.total} 段…`);
      const translations = await translateTexts(collected.texts, reason !== 'initial', sourceLang, targetLang);
      const applied = BilingualLib.applyTranslations({
        translations,
        pageUrl: location.href,
        targetLabel,
      });

      BilingualLib.updateToolbar(
        `已译 ${applied.ok} · 跳过 ${applied.skipped} · ${location.hostname}`,
      );
    } catch (err) {
      BilingualLib.updateToolbar(`翻译失败: ${err.message || err}`);
      console.error('[bilingual-translate]', err);
    } finally {
      running = false;
      if (pendingTargetChange) {
        pendingTargetChange = false;
        schedule('manual');
      }
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
