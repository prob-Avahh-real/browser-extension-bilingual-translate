/**
 * Browser-side page language detection. Loaded in content scripts / userscripts.
 * Detects among: en, zh-Hans, ko, ja, es, fr.
 */
(function (global) {
  const RE_LATIN = /[A-Za-z\u00c0-\u024f]/g;
  const RE_HAN = /[\u4e00-\u9fff]/g;
  const RE_HANGUL = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g;
  const RE_KANA = /[\u3040-\u30ff\u31f0-\u31ff]/g;

  function count(re, s) {
    return (s.match(re) || []).length;
  }

  function isMostlyEnglish(s) {
    const letters = s.replace(/[^A-Za-z\u4e00-\u9fff]/g, '');
    if (letters.length < 2) return false;
    const latin = (letters.match(/[A-Za-z]/g) || []).length;
    const cjk = (letters.match(/[\u4e00-\u9fff]/g) || []).length;
    return latin >= 2 && latin > cjk * 2;
  }

  /**
   * Does a single segment belong to the given source language?
   * Used by collect.js to filter candidate text nodes.
   */
  function textMatchesLang(s, lang) {
    const latin = count(RE_LATIN, s);
    const han = count(RE_HAN, s);
    const hangul = count(RE_HANGUL, s);
    const kana = count(RE_KANA, s);
    const cjk = han + hangul + kana;
    const letters = latin + cjk;
    if (letters < 2) return false;
    if (lang === 'zh-Hans') return han >= 2 && han > latin;
    if (lang === 'ko') return hangul >= 2 && hangul > latin;
    if (lang === 'ja') return kana >= 1 && kana + han >= 2 && kana + han > latin;
    // Latin-script sources: en / es / fr share the same filter.
    return latin >= 2 && latin > cjk * 2;
  }

  const LATIN_STOPS = {
    en: new Set(('the and of to in is are was were for with that this it as at by on be or an from not have has had but they you we can will would there their what about which when make like time just know take into your good some could them see other than then now only come its over think also back after use two how our work first well way even new want because any these give day most').split(' ')),
    es: new Set(('el la los las de del que en y un una por con para es son como pero si le se lo su sus al este esta estos estas eso esa entre sobre más ya muy puede están han tiene tienen cuando donde quien porque hasta durante según así entonces además también tampoco ni sino o e').split(' ')),
    fr: new Set(('le la les de des du un une et est sont que qui quoi en au aux dans sur pour par avec sans ce cette ces se sa ses son leur leurs ne plus moins comme mais ou où quand comment pourquoi parce très trop aussi toujours jamais seulement notamment afin dont vu faire font été être avoir avait ayant doit peut').split(' ')),
  };

  function detectLatinLang(sample) {
    const words = sample.toLowerCase().match(/[a-zà-ÿ']+/g) || [];
    const scores = { en: 0, es: 0, fr: 0 };
    for (const w of words) {
      if (LATIN_STOPS.en.has(w)) scores.en += 1;
      if (LATIN_STOPS.es.has(w)) scores.es += 1;
      if (LATIN_STOPS.fr.has(w)) scores.fr += 1;
    }
    let best = 'en';
    let bestScore = -1;
    for (const k of Object.keys(scores)) {
      if (scores[k] > bestScore) {
        bestScore = scores[k];
        best = k;
      }
    }
    return best;
  }

  function mapHtmlLang(lang) {
    if (!lang) return null;
    const l = lang.toLowerCase();
    if (l.startsWith('en')) return 'en';
    if (l.startsWith('zh')) return 'zh-Hans';
    if (l.startsWith('ko')) return 'ko';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('es')) return 'es';
    if (l.startsWith('fr')) return 'fr';
    return null;
  }

  /**
   * Page text sample that ignores our own overlay: wrapped segments contribute
   * their original source text via data-bi-en; everything else is walked raw.
   */
  function pageSample() {
    const parts = [];
    document.querySelectorAll('[data-bi-wrap]').forEach((el) => {
      const v = el.getAttribute('data-bi-en');
      if (v) parts.push(v);
    });
    const root = document.querySelector('#mw-content-text, article, main, [role="main"]') || document.body;
    if (!root) return parts.join(' ').slice(0, 8000);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    let guard = 0;
    while ((n = walker.nextNode()) && guard < 4000) {
      guard += 1;
      const p = n.parentElement;
      if (!p) continue;
      if (p.closest('[data-bi-wrap], #bilingual-toolbar')) continue;
      parts.push(n.textContent || '');
    }
    return parts.join(' ').slice(0, 8000);
  }

  function detectFromSample(sample) {
    if (!sample || !sample.trim()) return null;
    const latin = count(RE_LATIN, sample);
    const han = count(RE_HAN, sample);
    const hangul = count(RE_HANGUL, sample);
    const kana = count(RE_KANA, sample);
    const cjk = han + hangul + kana;

    if (hangul >= 4 && hangul > latin && hangul > han) return 'ko';
    if (kana >= 2 && kana + han > latin) return 'ja';
    if (han >= 4 && han > latin && kana < 2) return 'zh-Hans';
    if (latin >= 8 && latin > cjk * 2) return detectLatinLang(sample);

    // Fallbacks for sparse samples.
    if (hangul > latin && hangul > han && hangul >= 2) return 'ko';
    if (han > latin && han >= 2) return kana >= 1 ? 'ja' : 'zh-Hans';
    if (latin >= 2) return detectLatinLang(sample);
    return null;
  }

  /**
   * Returns one of 'en' | 'zh-Hans' | 'ko' | 'ja' | 'es' | 'fr', or null.
   */
  function detectPageLang() {
    const mapped = mapHtmlLang(document.documentElement.getAttribute('lang'));
    if (mapped) return mapped;
    return detectFromSample(pageSample());
  }

  function isEnglishPage() {
    return detectPageLang() === 'en';
  }

  global.BilingualLib = global.BilingualLib || {};
  global.BilingualLib.isMostlyEnglish = isMostlyEnglish;
  global.BilingualLib.textMatchesLang = textMatchesLang;
  global.BilingualLib.detectPageLang = detectPageLang;
  global.BilingualLib.isEnglishPage = isEnglishPage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
