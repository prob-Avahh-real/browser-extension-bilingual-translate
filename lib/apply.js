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
