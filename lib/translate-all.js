import { BATCH } from './constants.js';
import { acceptTranslation, glossaryLookup, properNounSuffix } from './glossary.js';
import { translateBatchEdge } from './translate-edge.js';
import { normalizeSourceCode, normalizeTargetLang } from './languages.js';

/**
 * @param {string[]} texts
 * @param {{ fast?: boolean, cache?: Map<string, object>, onProgress?: (done: number, total: number) => void, source?: string, target?: string, translateBatch?: (texts: string[], source: string, target: string) => Promise<string[]> }} opts
 */
export async function translateAll(texts, {
  fast = false,
  cache = new Map(),
  onProgress,
  source = 'en',
  target = 'zh-Hans',
  translateBatch = translateBatchEdge,
} = {}) {
  const src = normalizeSourceCode(source);
  const code = normalizeTargetLang(target);
  const results = new Array(texts.length);
  const needApi = [];

  for (let i = 0; i < texts.length; i++) {
    const q = texts[i].trim();
    const legacyKey = q.toLowerCase();
    const cacheKey = `${src}>${code}\n${legacyKey}`;
    const legacyRow = (src === 'en' && code === 'zh-Hans') ? cache.get(legacyKey) : null;
    const cached = cache.get(cacheKey) || legacyRow;
    if (cached) {
      results[i] = { ...cached, reason: 'cache' };
      continue;
    }
    // The built-in glossary is keyed by English UI terms; only useful for en sources.
    const hit = src === 'en' ? glossaryLookup(q, code) : null;
    if (hit) {
      const row = { text: hit, ok: true, reason: 'glossary', source: src, target: code };
      cache.set(cacheKey, row);
      results[i] = row;
    } else {
      needApi.push(i);
    }
  }

  for (let start = 0; start < needApi.length; start += BATCH) {
    const slice = needApi.slice(start, start + BATCH);
    const payload = slice.map((i) => texts[i]);
    onProgress?.(Math.min(start + BATCH, needApi.length), needApi.length);
    let translated = [];
    try {
      translated = await translateBatch(payload, src, code);
    } catch {
      translated = payload.map(() => '');
    }
    const retryIdx = [];
    for (let j = 0; j < slice.length; j++) {
      const i = slice[j];
      const srcText = texts[i].trim();
      const text = (translated[j] || '').trim();
      let accepted = acceptTranslation(srcText, text, code);
      if (!accepted.ok && !fast) retryIdx.push({ i, srcText });
      if (!accepted.ok && fast) {
        const g = src === 'en' ? glossaryLookup(srcText, code) : null;
        if (g) accepted = { ok: true, text: g, reason: 'glossary-fallback' };
        else if (srcText.length <= 24) accepted = { ok: true, text: `${srcText}${properNounSuffix(code)}`, reason: 'fast-keep' };
      }
      if (accepted.ok) {
        const row = { text: accepted.text || '', ok: true, reason: accepted.reason || 'ok', source: src, target: code };
        cache.set(`${src}>${code}\n${srcText.toLowerCase()}`, row);
        results[i] = row;
      } else {
        results[i] = { text: '', ok: false, reason: accepted.reason || 'fail', source: src, target: code };
      }
    }
    if (retryIdx.length && !fast) {
      try {
        const translated2 = await translateBatch(retryIdx.map((r) => r.srcText), src, code);
        for (let k = 0; k < retryIdx.length; k++) {
          const { i, srcText } = retryIdx[k];
          if (results[i]?.ok) continue;
          const accepted = acceptTranslation(srcText, (translated2[k] || '').trim(), code);
          if (accepted.ok) {
            const row = { text: accepted.text, ok: true, reason: accepted.reason || 'retry', source: src, target: code };
            cache.set(`${src}>${code}\n${srcText.toLowerCase()}`, row);
            results[i] = row;
          } else if (src === 'en') {
            const g = glossaryLookup(srcText, code);
            if (g) {
              const row = { text: g, ok: true, reason: 'glossary-fallback', source: src, target: code };
              cache.set(`${src}>${code}\n${srcText.toLowerCase()}`, row);
              results[i] = row;
            }
          }
        }
      } catch {
        /* ignore retry batch errors */
      }
    }
  }

  for (let i = 0; i < results.length; i++) {
    if (!results[i]) results[i] = { text: '', ok: false, reason: 'missing', source: src, target: code };
  }
  return results;
}
