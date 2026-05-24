// File: src/i18n.ts
// Re-export shim — canonical i18n lives in ./i18n/ (split per-locale).

export type { Language, Dictionary } from './i18n/index.js';
export {
  getLang,
  subscribeToLang,
  useLang,
  t,
  pluralCommands,
  changeLang
} from './i18n/index.js';
