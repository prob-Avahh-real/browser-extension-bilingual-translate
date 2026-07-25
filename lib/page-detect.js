/**
 * Browser-side page language detection. Loaded in content scripts / userscripts.
 */
(function (global) {
  function isMostlyEnglish(s) {
    const letters = s.replace(/[^A-Za-z\u4e00-\u9fff]/g, '');
    if (letters.length < 2) return false;
    const latin = (letters.match(/[A-Za-z]/g) || []).length;
    const cjk = (letters.match(/[\u4e00-\u9fff]/g) || []).length;
    return latin >= 2 && latin > cjk * 2;
  }

  function isEnglishPage() {
    const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (lang.startsWith('en')) return true;
    if (lang.startsWith('zh')) return false;

    const root =
      document.querySelector('#mw-content-text, article, main, [role="main"]') ||
      document.body;
    const sample = (root.innerText || '').slice(0, 4000);
    if (!sample.trim()) return false;
    return isMostlyEnglish(sample);
  }

  global.BilingualLib = global.BilingualLib || {};
  global.BilingualLib.isMostlyEnglish = isMostlyEnglish;
  global.BilingualLib.isEnglishPage = isEnglishPage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
