import { translateAll } from './lib/translate-all.js';
import {
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  normalizeSourceLang,
  normalizeTargetLang,
  targetLabel,
} from './lib/languages.js';

const memoryCache = new Map();
const STORAGE_KEY = 'bilingualTranslateCache';
const MAX_STORAGE_ENTRIES = 5000;

const LANGUAGE_OPTIONS = TARGET_LANGUAGES.map(({ code, label }) => ({ code, label }));
const SOURCE_OPTIONS = SOURCE_LANGUAGES.map(({ code, label }) => ({ code, label }));

async function loadStorageCache() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const entries = data[STORAGE_KEY] || {};
    for (const [k, v] of Object.entries(entries)) {
      if (!memoryCache.has(k)) memoryCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

async function persistCache() {
  try {
    const entries = Object.fromEntries([...memoryCache.entries()].slice(-MAX_STORAGE_ENTRIES));
    await chrome.storage.local.set({ [STORAGE_KEY]: entries });
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'TRANSLATE_BATCH') {
      await loadStorageCache();
      const target = normalizeTargetLang(msg.targetLang);
      const source = normalizeSourceLang(msg.sourceLang);
      const results = await translateAll(msg.texts || [], {
        fast: Boolean(msg.fast),
        cache: memoryCache,
        source: source === 'auto' ? 'en' : source,
        target,
      });
      persistCache().catch(() => {});
      sendResponse({ ok: true, results, target, source });
      return;
    }
    if (msg.type === 'GET_SETTINGS') {
      const data = await chrome.storage.local.get(['enabled', 'blockedHosts', 'targetLang', 'sourceLang']);
      const target = normalizeTargetLang(data.targetLang);
      const source = normalizeSourceLang(data.sourceLang);
      sendResponse({
        enabled: data.enabled !== false,
        blockedHosts: data.blockedHosts || [],
        targetLang: target,
        targetLabel: targetLabel(target),
        languages: LANGUAGE_OPTIONS,
        sourceLang: source,
        sourceLanguages: SOURCE_OPTIONS,
      });
      return;
    }
    if (msg.type === 'SET_ENABLED') {
      await chrome.storage.local.set({ enabled: Boolean(msg.enabled) });
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'SET_TARGET_LANG') {
      const target = normalizeTargetLang(msg.targetLang);
      await chrome.storage.local.set({ targetLang: target });
      sendResponse({ ok: true, targetLang: target, targetLabel: targetLabel(target) });
      return;
    }
    if (msg.type === 'SET_SOURCE_LANG') {
      const source = normalizeSourceLang(msg.sourceLang);
      await chrome.storage.local.set({ sourceLang: source });
      sendResponse({ ok: true, sourceLang: source });
      return;
    }
    if (msg.type === 'BLOCK_HOST') {
      const host = msg.host;
      const data = await chrome.storage.local.get(['blockedHosts']);
      const blocked = new Set(data.blockedHosts || []);
      if (host) blocked.add(host);
      await chrome.storage.local.set({ blockedHosts: [...blocked] });
      sendResponse({ ok: true, blockedHosts: [...blocked] });
      return;
    }
    if (msg.type === 'UNBLOCK_HOST') {
      const data = await chrome.storage.local.get(['blockedHosts']);
      const blocked = new Set(data.blockedHosts || []);
      blocked.delete(msg.host);
      await chrome.storage.local.set({ blockedHosts: [...blocked] });
      sendResponse({ ok: true, blockedHosts: [...blocked] });
      return;
    }
  })().catch((err) => {
    sendResponse({ ok: false, error: err.message || String(err) });
  });
  return true;
});

loadStorageCache();
