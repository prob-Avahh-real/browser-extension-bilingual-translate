/**
 * Supported languages for page translation (source detection + target output).
 * `edge` is the Microsoft Translator code, `mm` is the MyMemory langpair code,
 * `script` drives output validation in glossary.js.
 */
export const TARGET_LANGUAGES = [
  { code: 'en', label: 'English', edge: 'en', mm: 'en', script: 'latin' },
  { code: 'zh-Hans', label: '简体中文', edge: 'zh-Hans', mm: 'zh-CN', script: 'han' },
  { code: 'ko', label: '한국어', edge: 'ko', mm: 'ko', script: 'hangul' },
  { code: 'ja', label: '日本語', edge: 'ja', mm: 'ja', script: 'kana' },
  { code: 'es', label: 'Español', edge: 'es', mm: 'es', script: 'latin' },
  { code: 'fr', label: 'Français', edge: 'fr', mm: 'fr', script: 'latin' },
];

export const DEFAULT_TARGET_LANG = 'zh-Hans';
export const AUTO_SOURCE_LANG = 'auto';

export const SOURCE_LANGUAGES = [
  { code: AUTO_SOURCE_LANG, label: '自动检测' },
  ...TARGET_LANGUAGES,
];

export function normalizeTargetLang(value) {
  const found = TARGET_LANGUAGES.find((l) => l.code === value);
  return found ? found.code : DEFAULT_TARGET_LANG;
}

export function normalizeSourceLang(value) {
  if (value === AUTO_SOURCE_LANG) return AUTO_SOURCE_LANG;
  const found = TARGET_LANGUAGES.find((l) => l.code === value);
  return found ? found.code : AUTO_SOURCE_LANG;
}

/** Concrete source code for the translate API ('auto' falls back to 'en'). */
export function normalizeSourceCode(value) {
  const found = TARGET_LANGUAGES.find((l) => l.code === value);
  return found ? found.code : 'en';
}

export function targetLanguage(value) {
  return TARGET_LANGUAGES.find((l) => l.code === normalizeTargetLang(value)) || TARGET_LANGUAGES[1];
}

export function sourceLanguage(value) {
  return TARGET_LANGUAGES.find((l) => l.code === normalizeSourceCode(value)) || TARGET_LANGUAGES[0];
}

export function targetLabel(value) {
  return targetLanguage(value).label;
}

export function sourceLabel(value) {
  return sourceLanguage(value).label;
}

export function edgeCode(value) {
  return TARGET_LANGUAGES.find((l) => l.code === value)?.edge
    || targetLanguage(value).edge;
}

export function mmCode(value) {
  return TARGET_LANGUAGES.find((l) => l.code === value)?.mm
    || targetLanguage(value).mm;
}

export function targetEdgeCode(value) {
  return edgeCode(value);
}

export function targetMmCode(value) {
  return mmCode(value);
}
