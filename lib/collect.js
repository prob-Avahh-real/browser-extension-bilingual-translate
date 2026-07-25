/**
 * Collect English segments on the page and wrap with data-bi-wrap markers.
 */
(function (global) {
  function collectSegments({ max = 600, maxUi = 260, reset = true } = {}) {
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
