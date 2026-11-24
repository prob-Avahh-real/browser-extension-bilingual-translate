// ==UserScript==
// @name         多意 MulTranslate
// @namespace    https://github.com/prob-Avahh-real/multranslate
// @version      1.1.0
// @description  网页自动注入目标语言对照（正文/导航/控件），支持英/中/韩/日/西/法互译
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      edge.microsoft.com
// @connect      api.cognitive.microsofttranslator.com
// @connect      api.mymemory.translated.net
// ==/UserScript==

(function () {
  'use strict';
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

/**
 * Inject bilingual overlay styles once per page.
 */
(function (global) {
  const CSS = `
    #bilingual-toolbar {
      position: fixed !important;
      top: 0 !important; left: 0 !important; right: 0 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-wrap: wrap;
      gap: 10px 16px; align-items: center;
      padding: 12px 18px;
      background: linear-gradient(90deg, #0f3d2e, #1a5c45) !important;
      color: #f2fff8 !important;
      font: 14px/1.4 "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif !important;
      box-shadow: 0 2px 14px rgba(0,0,0,.35) !important;
    }
    #bilingual-toolbar button {
      margin-left: auto;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.35);
      color: #f2fff8;
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
      font: inherit;
    }
    #bilingual-toolbar select {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.35);
      color: #f2fff8;
      border-radius: 6px;
      padding: 4px 6px;
      font: inherit;
      cursor: pointer;
    }
    #bilingual-toolbar select:disabled {
      opacity: 0.6;
      cursor: default;
    }
    #bilingual-toolbar .bi-close {
      margin-left: auto;
    }
    [data-bi-wrap][data-bi-kind="body"] {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.85em !important;
      margin: 1.15em 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      max-width: 100%;
      box-sizing: border-box !important;
    }
    [data-bi-wrap][data-bi-kind="body"] .bi-zh {
      display: block !important;
      margin: 0 !important;
      padding: 0.75em 0.9em !important;
      color: #0a4d34 !important;
      font-weight: 650 !important;
      font-size: 1.06em !important;
      line-height: 1.65 !important;
      letter-spacing: 0.01em;
      font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif !important;
      background: #e8f5ef !important;
      border-left: 4px solid #1a5c45 !important;
      border-radius: 0 10px 10px 0 !important;
    }
    [data-bi-wrap][data-bi-kind="body"] .bi-en {
      display: block !important;
      margin: 0 !important;
      padding: 0.7em 0.9em !important;
      color: #3a3a3a !important;
      font-size: 0.95em !important;
      line-height: 1.6 !important;
      font-weight: 400 !important;
      opacity: 1 !important;
      background: #f4f4f5 !important;
      border-left: 4px solid #b0b0b0 !important;
      border-radius: 0 10px 10px 0 !important;
      border-top: 0 !important;
    }
    [data-bi-wrap][data-bi-kind="ui"] {
      display: inline !important;
      vertical-align: baseline;
      margin: 0 0.45em 0.15em 0 !important;
      padding: 0.05em 0 !important;
      line-height: 1.45 !important;
      white-space: normal !important;
      max-width: 100%;
    }
    [data-bi-wrap][data-bi-kind="ui"] .bi-zh {
      display: inline !important;
      color: #0b5c3a !important;
      font-weight: 700 !important;
      font-size: 1em !important;
      line-height: inherit !important;
      font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    [data-bi-wrap][data-bi-kind="ui"] .bi-sep {
      display: inline !important;
      color: #9a9a9a !important;
      font-weight: 400 !important;
      margin: 0 0.28em !important;
      opacity: 1;
      user-select: none;
    }
    [data-bi-wrap][data-bi-kind="ui"] .bi-en {
      display: inline !important;
      color: #5c5c5c !important;
      opacity: 1 !important;
      font-size: 0.9em !important;
      font-weight: 400 !important;
      line-height: inherit !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .vector-toc-list-item,
    .vector-toc-contents li,
    .vector-menu-content-list li,
    .mw-list-item {
      margin-bottom: 0.65em !important;
      padding-top: 0.2em !important;
      padding-bottom: 0.2em !important;
      line-height: 1.45 !important;
    }
    .vector-toc-list-item,
    .vector-toc-text,
    .vector-toc-link,
    .vector-toc-contents,
    .vector-user-links {
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
      white-space: normal !important;
    }
    [data-bi-wrap][data-bi-kind="control"] {
      color: #0b5c3a !important;
      font-weight: 600 !important;
      font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif !important;
    }
  `;

  function ensureStyles() {
    if (document.getElementById('bilingual-style')) return;
    const style = document.createElement('style');
    style.id = 'bilingual-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const toolbarState = {
    target: 'zh-Hans',
    languages: null,
    onTargetChange: null,
  };

  function renderLanguageSelect(bar) {
    const langs = toolbarState.languages;
    if (!langs || !langs.length) return null;
    const select = document.createElement('select');
    select.id = 'bilingual-lang';
    select.setAttribute('aria-label', 'target language');
    for (const lang of langs) {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.label || lang.code;
      select.appendChild(opt);
    }
    select.value = toolbarState.target || langs[0].code;
    select.disabled = !toolbarState.onTargetChange;
    select.addEventListener('change', () => {
      toolbarState.onTargetChange?.(select.value);
    });
    bar.appendChild(select);
    return select;
  }

  function showToolbar(message, { onClose, onTargetChange, target, languages } = {}) {
    ensureStyles();
    if (target) toolbarState.target = target;
    if (languages) toolbarState.languages = languages;
    if (onTargetChange !== undefined) toolbarState.onTargetChange = onTargetChange;

    let bar = document.getElementById('bilingual-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bilingual-toolbar';
      document.documentElement.appendChild(bar);
      document.body.style.paddingTop = '48px';
    }
    bar.innerHTML = `<strong>多意</strong><span>${message || '正在识别并翻译…'}</span>`;
    renderLanguageSelect(bar);
    if (onClose) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bi-close';
      btn.textContent = '关闭本页';
      btn.addEventListener('click', onClose);
      bar.appendChild(btn);
    }
  }

  function updateToolbar(message) {
    const bar = document.getElementById('bilingual-toolbar');
    if (!bar) return;
    const span = bar.querySelector('span');
    if (span) span.textContent = message;
  }

  function teardownBilingual() {
    document.querySelectorAll('[data-bi-wrap]').forEach((el) => {
      const en = el.getAttribute('data-bi-en');
      const kind = el.getAttribute('data-bi-kind');
      if (en == null) return;
      if (kind === 'control') {
        el.textContent = en;
        el.removeAttribute('data-bi-wrap');
        el.removeAttribute('data-bi-en');
        el.removeAttribute('data-bi-kind');
        el.removeAttribute('title');
        return;
      }
      el.replaceWith(document.createTextNode(en));
    });
    document.getElementById('bilingual-toolbar')?.remove();
    document.getElementById('bilingual-style')?.remove();
    document.body.style.paddingTop = '';
  }

  global.BilingualLib = global.BilingualLib || {};
  global.BilingualLib.ensureStyles = ensureStyles;
  global.BilingualLib.showToolbar = showToolbar;
  global.BilingualLib.updateToolbar = updateToolbar;
  global.BilingualLib.teardownBilingual = teardownBilingual;
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Collect English segments on the page and wrap with data-bi-wrap markers.
 */
(function (global) {
  function collectSegments({ max = 600, maxUi = 260, reset = true, source = 'en' } = {}) {
    if (reset) {
      global.BilingualLib?.teardownBilingual?.();
    }

    const SKIP_TAGS = new Set([
      'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
      'CODE', 'PRE', 'KBD', 'SAMP', 'SVG', 'PATH', 'MATH', 'IFRAME',
    ]);
    const BLOCK_TAGS = new Set([
      'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'DT', 'DD',
      'FIGCAPTION', 'LABEL', 'BUTTON', 'SUMMARY', 'CAPTION',
    ]);

    function mostlyEnglish(s) {
      const fn = global.BilingualLib?.textMatchesLang;
      if (fn) return fn(s, source);
      const letters = s.replace(/[^A-Za-z\u4e00-\u9fff]/g, '');
      if (letters.length < 2) return false;
      const latin = (letters.match(/[A-Za-z]/g) || []).length;
      const cjk = (letters.match(/[\u4e00-\u9fff]/g) || []).length;
      return latin >= 2 && latin > cjk * 2;
    }

    function visible(el) {
      if (!el) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
      return true;
    }

    function cleanText(el) {
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    const out = [];
    const kinds = [];
    let idx = 0;
    const claimed = new Set();

    function claim(el) {
      claimed.add(el);
      el.querySelectorAll('*').forEach((c) => claimed.add(c));
    }

    function isClaimedAncestor(el) {
      let anc = el.parentElement;
      while (anc) {
        if (claimed.has(anc)) return true;
        anc = anc.parentElement;
      }
      return false;
    }

    function wrapReplace(el, en, kind) {
      const wrap = document.createElement(kind === 'body' ? 'div' : 'span');
      wrap.setAttribute('data-bi-wrap', String(idx));
      wrap.setAttribute('data-bi-en', en);
      wrap.setAttribute('data-bi-kind', kind);
      wrap.textContent = en;
      el.replaceWith(wrap);
      out.push(en);
      kinds.push(kind);
      idx += 1;
    }

    function markControl(el, en) {
      if (idx >= max) return false;
      if (el.getAttribute('data-bi-wrap') != null) return false;
      el.setAttribute('data-bi-wrap', String(idx));
      el.setAttribute('data-bi-en', en);
      el.setAttribute('data-bi-kind', 'control');
      claimed.add(el);
      out.push(en);
      kinds.push('control');
      idx += 1;
      return true;
    }

    function tryWrap(el, kind) {
      if (idx >= max) return false;
      if (claimed.has(el) || isClaimedAncestor(el)) return false;
      if (el.querySelector('[data-bi-wrap]')) return false;
      for (const c of el.querySelectorAll('*')) {
        if (claimed.has(c)) return false;
      }
      if (SKIP_TAGS.has(el.tagName)) return false;
      if (el.closest('[data-bi-wrap], #bilingual-toolbar')) return false;
      if (el.closest('.cdx-radio, .cdx-toggle-switch, [class*="clientpref"] .cdx-radio')) return false;
      if (!visible(el)) return false;
      const en = cleanText(el);
      const maxLen = kind === 'body' || BLOCK_TAGS.has(el.tagName) || /^H[1-6]$/.test(el.tagName) || el.tagName === 'P'
        ? 2500
        : 900;
      if (en.length < 2 || en.length > maxLen) return false;
      if (!mostlyEnglish(en)) return false;
      if (/^https?:\/\//i.test(en)) return false;
      if (el.id === 'firstHeading' || el.classList?.contains('mw-page-title-main')) kind = 'body';
      if ((el.tagName === 'P' || /^H[1-6]$/.test(el.tagName)) && en.length >= 24) kind = 'body';
      claim(el);
      wrapReplace(el, en, kind);
      return true;
    }

    const maxBody = Math.max(80, max - maxUi);
    const contentRoot =
      document.querySelector('#mw-content-text .mw-parser-output') ||
      document.querySelector('#mw-content-text, article, main, [role="main"]') ||
      document.body;

    const prefer = [...contentRoot.querySelectorAll('h1, h2, h3, h4, h5, h6, p')];
    for (const el of prefer) {
      if (idx >= maxBody) break;
      if (el.closest('.toc, #toc, .navbox, .sidebar, .mw-editsection, .reference, .references, .reflist')) continue;
      tryWrap(el, 'body');
    }

    let uiCount = 0;
    const maxRight = Math.min(100, Math.floor(maxUi * 0.4));

    function collectAndWrap(selectors, limit) {
      const list = [];
      for (const sel of selectors) {
        try {
          document.querySelectorAll(sel).forEach((el) => list.push(el));
        } catch { /* ignore */ }
      }
      const seen = new Set();
      let n = 0;
      for (const el of list) {
        if (n >= limit || uiCount >= maxUi || idx >= max) break;
        if (seen.has(el)) continue;
        seen.add(el);
        const t = cleanText(el);
        if (t.length < 2 || t.length > 80) continue;
        if (el.querySelector('p, h1, h2, h3, ul, ol')) continue;
        if (el.closest('.cdx-radio__icon, .cdx-toggle-switch__switch')) continue;
        if (tryWrap(el, 'ui')) {
          n += 1;
          uiCount += 1;
        }
      }
      return n;
    }

    collectAndWrap([
      '.vector-column-end .vector-pinnable-header-label',
      '.vector-column-end .vector-menu-heading',
      '.vector-column-end .vector-pinnable-header-toggle-button',
      '#vector-appearance .vector-pinnable-header-label',
      '#vector-appearance .vector-pinnable-header-toggle-button',
      '#vector-page-tools .vector-pinnable-header-label',
      '#vector-page-tools a',
      '.vector-column-end .mw-list-item > a',
      '.infobox th', '.infobox a',
      '.sidebar a', '.sidebar-list-title',
    ], maxRight);

    collectAndWrap([
      '#vector-toc a', '#mw-panel-toc a', '.vector-toc a', '#toc a',
      'header a', 'nav a', '[role="navigation"] a', '[role="banner"] a',
      '.vector-header a', '.vector-menu a', '.mw-portlet a',
      '[role="tab"]', '.vector-toc-list-item a',
      '.vector-page-titlebar a', '.vector-user-links a',
      '#p-lang-btn', '.mw-interlanguage-selector',
    ], maxUi);

    if (uiCount < maxUi && idx < max) {
      const headers = document.querySelectorAll(
        '#vector-appearance .vector-pinnable-header-label, ' +
        '#vector-appearance .vector-menu-heading, ' +
        '#vector-page-tools .vector-pinnable-header-label, ' +
        '.vector-column-end .vector-pinnable-header-label, ' +
        '.vector-column-end .vector-menu-heading',
      );
      for (const el of headers) {
        if (uiCount >= maxUi || idx >= max) break;
        if (el.closest('[data-bi-wrap]')) continue;
        const t = cleanText(el);
        if (t.length < 2 || t.length > 40) continue;
        if (tryWrap(el, 'ui')) uiCount += 1;
      }
    }

    {
      const controlSel = [
        '#vector-appearance .cdx-label__label',
        '#vector-appearance .cdx-radio__label',
        '.vector-column-end .cdx-label__label',
        '.vector-column-end .cdx-radio__label',
        '[class*="clientpref"] .cdx-label__label',
        '[class*="clientpref"] .cdx-radio__label',
        '#vector-appearance legend',
        '.vector-column-end legend',
      ].join(',');
      const controls = document.querySelectorAll(controlSel);
      for (const el of controls) {
        if (idx >= max) break;
        if (el.closest('[data-bi-wrap]')) continue;
        const t = cleanText(el);
        if (t.length < 2 || t.length > 48) continue;
        if (!mostlyEnglish(t)) continue;
        if (markControl(el, t)) uiCount += 1;
      }
    }

    if (uiCount < maxUi && idx < max) {
      const extras = [...document.querySelectorAll(
        '.vector-column-end .mw-list-item > a, #vector-page-tools a, a, span',
      )];
      const seen = new Set();
      for (const el of extras) {
        if (uiCount >= maxUi || idx >= max) break;
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.closest('.cdx-radio, .cdx-label, [class*="clientpref"], #vector-appearance label')) continue;
        const t = cleanText(el);
        if (t.length < 2 || t.length > 70) continue;
        if (el.querySelector('p, h1, h2, h3, ul, ol')) continue;
        if (tryWrap(el, 'ui')) uiCount += 1;
      }
    }

    const listItems = [...contentRoot.querySelectorAll('li')].filter((el) => {
      if (el.closest('.toc, #toc, .navbox, .sidebar, .mw-editsection, .reference, .references, .reflist')) return false;
      const t = cleanText(el);
      return t.length >= 8 && t.length <= 220;
    }).slice(0, 60);
    for (const el of listItems) {
      if (idx >= max) break;
      tryWrap(el, cleanText(el).length >= 36 ? 'body' : 'ui');
    }

    const moreBlocks = [...document.body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, td, th, figcaption')];
    for (const el of moreBlocks) {
      if (idx >= max) break;
      tryWrap(el, cleanText(el).length >= 36 ? 'body' : 'ui');
    }

    if (idx < max) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      for (const node of nodes) {
        if (idx >= max) break;
        const parent = node.parentElement;
        if (!parent) continue;
        if (SKIP_TAGS.has(parent.tagName)) continue;
        if (parent.closest('[data-bi-wrap], #bilingual-toolbar')) continue;
        if (parent.closest('#mw-content-text .mw-parser-output, .mw-parser-output')) continue;
        if (parent.closest('.cdx-radio, .cdx-label, [class*="clientpref"], input[type="radio"]')) continue;
        if (!visible(parent)) continue;
        const trimmed = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (trimmed.length < 3 || trimmed.length > 200) continue;
        if (!mostlyEnglish(trimmed)) continue;
        if (/^https?:\/\//i.test(trimmed)) continue;
        if (/^[\d\s.,;:!?'"()\-–—/]+$/.test(trimmed)) continue;
        const wrap = document.createElement('span');
        wrap.setAttribute('data-bi-wrap', String(idx));
        wrap.setAttribute('data-bi-en', trimmed);
        wrap.setAttribute('data-bi-kind', 'ui');
        wrap.textContent = trimmed;
        node.parentNode.replaceChild(wrap, node);
        out.push(trimmed);
        kinds.push('ui');
        idx += 1;
      }
    }

    return { texts: out, kinds, total: out.length, ui: uiCount };
  }

  global.BilingualLib = global.BilingualLib || {};
  global.BilingualLib.collectSegments = collectSegments;
})(typeof globalThis !== 'undefined' ? globalThis : window);

/**
 * Apply translated bilingual overlay to collected segments.
 */
(function (global) {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function translatedText(item) {
    return item?.text ?? item?.zh ?? '';
  }

  function applyTranslations({ translations, pageUrl = location.href, targetLabel = '' }) {
    global.BilingualLib?.ensureStyles?.();

    let ok = 0;
    let skipped = 0;
    const skippedDetail = [];

    for (let i = 0; i < translations.length; i++) {
      const el = document.querySelector(`[data-bi-wrap="${i}"]`);
      if (!el) {
        skippedDetail.push({ i, reason: 'dom-missing' });
        continue;
      }
      const en = el.getAttribute('data-bi-en') || '';
      const item = translations[i] || {};
      const kind = el.getAttribute('data-bi-kind') || 'body';
      const text = translatedText(item);
      if (!item.ok || !text.trim()) {
        if (kind === 'control') {
          el.textContent = en;
          el.removeAttribute('data-bi-wrap');
          el.removeAttribute('data-bi-en');
          el.removeAttribute('data-bi-kind');
        } else {
          el.replaceWith(document.createTextNode(en));
        }
        skipped += 1;
        skippedDetail.push({
          i,
          reason: !item.ok ? (item.reason || 'not-ok') : 'empty-translation-at-apply',
          en: en.slice(0, 120),
          text: text.slice(0, 80),
        });
        continue;
      }
      if (kind === 'control') {
        el.textContent = text;
        el.setAttribute('title', `${text} / ${en}`);
        ok += 1;
      } else if (kind === 'ui') {
        el.innerHTML =
          `<span class="bi-zh">${escapeHtml(text)}</span>` +
          `<span class="bi-sep"> · </span>` +
          `<span class="bi-en">${escapeHtml(en)}</span>`;
        ok += 1;
      } else {
        el.innerHTML =
          `<span class="bi-zh">${escapeHtml(text)}</span>` +
          `<span class="bi-en">${escapeHtml(en)}</span>`;
        ok += 1;
      }
    }

    const host = pageUrl.replace(/^https?:\/\//, '').slice(0, 36);
    const targetPart = targetLabel ? `${targetLabel} · ` : '';
    global.BilingualLib?.showToolbar?.(
      `已译 ${ok} · ${targetPart}正文对照 / 导航对照 / 控件翻译（悬停看英文） · ${host}`,
    );
    document.body.style.paddingTop = '56px';
    const content = document.querySelector('#mw-content-text, .mw-body-content, article, main');
    if (content) content.style.lineHeight = '1.6';

    return { ok, skipped, skippedDetail };
  }

  global.BilingualLib = global.BilingualLib || {};
  global.BilingualLib.applyTranslations = applyTranslations;
})(typeof globalThis !== 'undefined' ? globalThis : window);


  const BATCH = 40;
  const LANGUAGES = [{"code":"en","label":"English","edge":"en","mm":"en","script":"latin"},{"code":"zh-Hans","label":"简体中文","edge":"zh-Hans","mm":"zh-CN","script":"han"},{"code":"ko","label":"한국어","edge":"ko","mm":"ko","script":"hangul"},{"code":"ja","label":"日本語","edge":"ja","mm":"ja","script":"kana"},{"code":"es","label":"Español","edge":"es","mm":"es","script":"latin"},{"code":"fr","label":"Français","edge":"fr","mm":"fr","script":"latin"}];
  let TARGET_LANG = 'zh-Hans';
  let SOURCE_LANG = 'auto';
  let edgeToken = null;
  let edgeTokenAt = 0;
  const cache = new Map();

  function langMeta(code) {
    return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
  }

  function hasTargetScript(s) {
    const text = s || '';
    const script = langMeta(TARGET_LANG).script;
    if (script === 'han') return /[\u4e00-\u9fff]/.test(text);
    if (script === 'hangul') return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text);
    if (script === 'kana') return /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]/.test(text);
    if (script === 'latin') return /[A-Za-z\u00c0-\u024f]/.test(text);
    return true;
  }

  const PROPER_NOUN_SUFFIX = {
    'zh-Hans': '（专有名词）',
    ko: '（고유명사）',
    ja: '（固有名詞）',
    es: ' (nombre propio)',
    fr: ' (nom propre)',
  };

  function gmFetch(url, opts = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: opts.method || 'GET',
        url,
        headers: opts.headers || {},
        data: opts.body || undefined,
        onload: (r) => resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, text: () => Promise.resolve(r.responseText), json: () => Promise.resolve(JSON.parse(r.responseText)) }),
        onerror: reject,
      });
    });
  }

  async function getEdgeToken() {
    if (edgeToken && Date.now() - edgeTokenAt < 8 * 60 * 1000) return edgeToken;
    const res = await gmFetch('https://edge.microsoft.com/translate/auth');
    if (!res.ok) throw new Error('edge auth');
    edgeToken = await res.text();
    edgeTokenAt = Date.now();
    return edgeToken;
  }

  async function translateBatchEdge(texts) {
    const token = await getEdgeToken();
    const from = encodeURIComponent(langMeta(SOURCE_LANG === 'auto' ? 'en' : SOURCE_LANG).edge);
    const to = encodeURIComponent(langMeta(TARGET_LANG).edge);
    const res = await gmFetch(
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=' + from + '&to=' + to,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(texts.map((t) => ({ Text: String(t).slice(0, 2000) }))),
      },
    );
    if (!res.ok) throw new Error('edge translate');
    const data = await res.json();
    return data.map((row) => row?.translations?.[0]?.text || '');
  }

  async function translateOneMyMemory(text) {
    const q = encodeURIComponent(text.slice(0, 480));
    const pair = langMeta(SOURCE_LANG === 'auto' ? 'en' : SOURCE_LANG).mm + '|' + langMeta(TARGET_LANG).mm;
    const res = await gmFetch('https://api.mymemory.translated.net/get?q=' + q + '&langpair=' + pair);
    const data = await res.json();
    return data?.responseData?.translatedText || '';
  }

  function acceptText(en, text) {
    const e = (en || '').trim();
    const t = (text || '').trim();
    if (!t) return { ok: false, text: '' };
    if (!hasTargetScript(t)) {
      if (e.length <= 24 && /^[A-Za-z0-9.+\/_-]+$/.test(e)) {
        return { ok: true, text: e + (PROPER_NOUN_SUFFIX[TARGET_LANG] || PROPER_NOUN_SUFFIX['zh-Hans']) };
      }
      return { ok: false, text: t };
    }
    if (t.toLowerCase() === e.toLowerCase()) return { ok: false, text: t };
    return { ok: true, text: t };
  }

  async function translateAll(texts) {
    const results = new Array(texts.length);
    const need = [];
    for (let i = 0; i < texts.length; i++) {
      const key = SOURCE_LANG + '>' + TARGET_LANG + '\n' + texts[i].trim().toLowerCase();
      if (cache.has(key)) { results[i] = cache.get(key); continue; }
      need.push(i);
    }
    for (let s = 0; s < need.length; s += BATCH) {
      const slice = need.slice(s, s + BATCH);
      const payload = slice.map((i) => texts[i]);
      let translated = [];
      try { translated = await translateBatchEdge(payload); } catch {
        translated = [];
        for (const t of payload) {
          try { translated.push(await translateOneMyMemory(t)); } catch { translated.push(''); }
        }
      }
      for (let j = 0; j < slice.length; j++) {
        const i = slice[j];
        const accepted = acceptText(texts[i], translated[j]);
        const row = accepted.ok ? { ok: true, text: accepted.text } : { ok: false, text: '', reason: 'fail' };
        cache.set(SOURCE_LANG + '>' + TARGET_LANG + '\n' + texts[i].trim().toLowerCase(), row);
        results[i] = row;
      }
    }
    for (let i = 0; i < results.length; i++) {
      if (!results[i]) results[i] = { ok: false, text: '', reason: 'missing' };
    }
    return results;
  }

  const MAX_SEGMENTS = 600;
  const MAX_UI = 260;
  let running = false;
  let timer = null;
  let pendingTargetChange = false;

  try {
    const saved = GM_getValue('bi-target-lang', 'zh-Hans');
    if (LANGUAGES.some((l) => l.code === saved)) TARGET_LANG = saved;
  } catch { /* ignore */ }

  function targetLabel() {
    return langMeta(TARGET_LANG).label || TARGET_LANG;
  }

  function resolveSource() {
    const detected = BilingualLib.detectPageLang?.() || null;
    if (!detected) return null;
    return SOURCE_LANG === 'auto' ? detected : SOURCE_LANG;
  }

  async function run(reason) {
    if (running) return;
    const source = resolveSource();
    if (!source) return;
    if (source === TARGET_LANG) {
      BilingualLib.showToolbar('源语言与目标语言相同，已跳过');
      setTimeout(() => BilingualLib.teardownBilingual(), 2500);
      return;
    }
    SOURCE_LANG = source;
    running = true;
    try {
      BilingualLib.showToolbar('正在识别并翻译…', {
        target: TARGET_LANG,
        languages: LANGUAGES,
        onTargetChange: (code) => {
          pendingTargetChange = true;
          try { GM_setValue('bi-target-lang', code); } catch { /* ignore */ }
          TARGET_LANG = code;
          schedule('manual');
        },
      });
      const collected = BilingualLib.collectSegments({ max: MAX_SEGMENTS, maxUi: MAX_UI, reset: true, source: SOURCE_LANG });
      if (!collected.texts.length) return;
      const translations = await translateAll(collected.texts);
      BilingualLib.applyTranslations({ translations, pageUrl: location.href, targetLabel: targetLabel() });
    } catch (e) {
      BilingualLib.updateToolbar('翻译失败: ' + (e.message || e));
    } finally {
      running = false;
      if (pendingTargetChange) {
        pendingTargetChange = false;
        schedule('manual');
      }
    }
  }

  function schedule(reason) {
    clearTimeout(timer);
    timer = setTimeout(() => run(reason), reason === 'initial' ? 400 : 500);
  }

  const _push = history.pushState.bind(history);
  history.pushState = (...a) => { _push(...a); schedule('spa'); };
  const _replace = history.replaceState.bind(history);
  history.replaceState = (...a) => { _replace(...a); schedule('spa'); };
  window.addEventListener('popstate', () => schedule('spa'));

  schedule('initial');
})();
