import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const toolsLib = path.join(here, '../../tools/lib/bilingual');

const { TARGET_LANGUAGES, SOURCE_LANGUAGES, normalizeTargetLang, normalizeSourceLang, normalizeSourceCode, targetLanguage, edgeCode, mmCode } =
  await import(path.join(toolsLib, 'languages.js'));
const { glossaryLookup, acceptTranslation, hasTargetScript, properNounSuffix } =
  await import(path.join(toolsLib, 'glossary.js'));
const { translateAll } = await import(path.join(toolsLib, 'translate-all.js'));

test('languages registry covers en/zh/ko/ja/es/fr', () => {
  const codes = TARGET_LANGUAGES.map((l) => l.code);
  for (const code of ['en', 'zh-Hans', 'ko', 'ja', 'es', 'fr']) {
    assert.ok(codes.includes(code), `missing ${code}`);
  }
  assert.equal(normalizeTargetLang('ko'), 'ko');
  assert.equal(normalizeTargetLang('de'), 'zh-Hans');
  assert.equal(edgeCode('ja'), 'ja');
  assert.equal(edgeCode('zh-Hans'), 'zh-Hans');
  assert.equal(mmCode('fr'), 'fr');
  assert.equal(mmCode('zh-Hans'), 'zh-CN');
  assert.equal(targetLanguage('es').script, 'latin');
});

test('source language helpers', () => {
  assert.equal(normalizeSourceLang('auto'), 'auto');
  assert.equal(normalizeSourceLang('ko'), 'ko');
  assert.equal(normalizeSourceLang('de'), 'auto');
  assert.equal(normalizeSourceCode('auto'), 'en');
  assert.equal(normalizeSourceCode('ja'), 'ja');
  assert.ok(SOURCE_LANGUAGES.some((l) => l.code === 'auto'));
});

test('glossaryLookup returns target-specific UI translations', () => {
  assert.equal(glossaryLookup('search', 'zh-Hans'), '搜索');
  assert.equal(glossaryLookup('search', 'ko'), '검색');
  assert.equal(glossaryLookup('search', 'ja'), '検索');
  assert.equal(glossaryLookup('search', 'es'), 'Buscar');
  assert.equal(glossaryLookup('search', 'fr'), 'Rechercher');
  assert.equal(glossaryLookup('log in', 'fr'), 'Se connecter');
});

test('hasTargetScript validates output script per language', () => {
  assert.equal(hasTargetScript('搜索', 'zh-Hans'), true);
  assert.equal(hasTargetScript('검색', 'ko'), true);
  assert.equal(hasTargetScript('検索', 'ja'), true);
  assert.equal(hasTargetScript('Buscar', 'es'), true);
  assert.equal(hasTargetScript('Rechercher', 'fr'), true);
  assert.equal(hasTargetScript('Search results', 'ko'), false);
});

test('acceptTranslation is target-aware', () => {
  const okJa = acceptTranslation('Search', '検索', 'ja');
  assert.equal(okJa.ok, true);
  assert.equal(okJa.text, '検索');

  const okEs = acceptTranslation('Search results', 'Resultados de búsqueda', 'es');
  assert.equal(okEs.ok, true);

  const latinForKorean = acceptTranslation('Search results', 'Search results page', 'ko');
  assert.equal(latinForKorean.ok, false);
  assert.equal(latinForKorean.reason, 'no-target-script');

  const echo = acceptTranslation('Search results', 'Search results', 'es');
  assert.equal(echo.ok, false);
  assert.equal(echo.reason, 'echo-source');

  const proper = acceptTranslation('GPT-4', 'GPT-4', 'ja');
  assert.equal(proper.ok, true);
  assert.match(proper.text, /GPT-4/);
});

test('properNounSuffix is localized', () => {
  assert.equal(properNounSuffix('zh-Hans'), '（专有名词）');
  assert.equal(properNounSuffix('ko'), '（고유명사）');
  assert.equal(properNounSuffix('es'), ' (nombre propio)');
});

test('translateAll passes source+target to batch and separates cache per pair', async () => {
  const calls = [];
  const translateBatch = async (texts, source, target) => {
    calls.push(`${source}>${target}`);
    const prefix = { ko: '한국어:', ja: '日本語:', 'zh-Hans': '中文:', en: 'EN:' }[target] || 'FR:';
    return texts.map((t) => `${prefix}${t}`);
  };
  const cache = new Map();
  const en = ['Search results', 'Machine learning'];

  const koResults = await translateAll(en, { target: 'ko', cache, translateBatch, fast: true });
  assert.deepEqual(calls, ['en>ko']);
  assert.equal(koResults[0].text, '한국어:Search results');
  assert.equal(koResults[0].source, 'en');
  assert.equal(koResults[0].target, 'ko');

  const frResults = await translateAll(en, { target: 'fr', cache, translateBatch, fast: true });
  assert.deepEqual(calls, ['en>ko', 'en>fr']);
  assert.equal(frResults[0].text, 'FR:Search results');

  // Same target, different source must not share cache.
  const zhSrc = ['搜索结果', '机器学习'];
  const zhToKo = await translateAll(zhSrc, { source: 'zh-Hans', target: 'ko', cache, translateBatch, fast: true });
  assert.deepEqual(calls, ['en>ko', 'en>fr', 'zh-Hans>ko']);
  assert.equal(zhToKo[0].text, '한국어:搜索结果');

  // Second en→ko run should hit cache and not call the API again.
  calls.length = 0;
  const koAgain = await translateAll(en, { target: 'ko', cache, translateBatch, fast: true });
  assert.equal(calls.length, 0);
  assert.equal(koAgain[0].reason, 'cache');
});
