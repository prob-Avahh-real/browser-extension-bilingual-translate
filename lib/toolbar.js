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

  function showToolbar(message, { onClose } = {}) {
    ensureStyles();
    let bar = document.getElementById('bilingual-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bilingual-toolbar';
      document.documentElement.appendChild(bar);
      document.body.style.paddingTop = '48px';
    }
    bar.innerHTML = `<strong>全页中英对照</strong><span>${message || '正在识别并翻译…'}</span>`;
    if (onClose) {
      const btn = document.createElement('button');
      btn.type = 'button';
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
