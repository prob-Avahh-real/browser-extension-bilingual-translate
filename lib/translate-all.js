import { BATCH } from './constants.js';
import { acceptTranslation, glossaryLookup } from './glossary.js';
import { translateBatchEdge } from './translate-edge.js';

/**
 * @param {string[]} texts
 * @param {{ fast?: boolean, cache?: Map<string, object>, onProgress?: (done: number, total: number) => void }} opts
 */
export async function translateAll(texts, { fast = false, cache = new Map(), onProgress } = {}) {
  const results = new Array(texts.length);
  const needApi = [];

  for (let i = 0; i < texts.length; i++) {
    const q = texts[i].trim();
    const cacheKey = q.toLowerCase();
    if (cache.has(cacheKey)) {
      results[i] = { ...cache.get(cacheKey), reason: 'cache' };
      continue;
    }
    const hit = glossaryLookup(q);
    if (hit) {
      const row = { zh: hit, ok: true, reason: 'glossary' };
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
    let zhs = [];
    try {
      zhs = await translateBatchEdge(payload);
    } catch {
      zhs = payload.map(() => '');
    }
    const retryIdx = [];
    for (let j = 0; j < slice.length; j++) {
      const i = slice[j];
      const en = texts[i].trim();
      const zh = (zhs[j] || '').trim();
      let accepted = acceptTranslation(en, zh);
      if (!accepted.ok && !fast) retryIdx.push({ i, en });
      if (!accepted.ok && fast) {
        const g = glossaryLookup(en);
        if (g) accepted = { ok: true, zh: g, reason: 'glossary-fallback' };
        else if (en.length <= 24) accepted = { ok: true, zh: `${en}（专有名词）`, reason: 'fast-keep' };
      }
      if (accepted.ok) {
        const row = { zh: accepted.zh || '', ok: true, reason: accepted.reason || 'ok' };
        cache.set(en.toLowerCase(), row);
        results[i] = row;
      } else {
        results[i] = { zh: '', ok: false, reason: accepted.reason || 'fail' };
      }
    }
    if (retryIdx.length && !fast) {
      try {
        const z2 = await translateBatchEdge(retryIdx.map((r) => r.en));
        for (let k = 0; k < retryIdx.length; k++) {
          const { i, en } = retryIdx[k];
          if (results[i]?.ok) continue;
          const accepted = acceptTranslation(en, (z2[k] || '').trim());
          if (accepted.ok) {
            const row = { zh: accepted.zh, ok: true, reason: accepted.reason || 'retry' };
            cache.set(en.toLowerCase(), row);
            results[i] = row;
          } else {
            const g = glossaryLookup(en);
            if (g) {
              const row = { zh: g, ok: true, reason: 'glossary-fallback' };
              cache.set(en.toLowerCase(), row);
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
    if (!results[i]) results[i] = { zh: '', ok: false, reason: 'missing' };
  }
  return results;
}
