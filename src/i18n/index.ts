// File: src/i18n/index.ts
// Canonical i18n entry point.
// Per-locale dictionaries live in ./locales/<lang>.ts so they can grow independently.

import { useEffect, useState } from 'react';
import { upsertEnvLine } from '../utils/helpers.js';
import { prefersAsciiOutput } from '../utils/terminal.js';
import { en } from './locales/en.js';
import { ru } from './locales/ru.js';
import type { Dictionary, Language } from './types.js';

export type { Language, Dictionary } from './types.js';

const dictionary: Record<Language, Dictionary> = { en, ru };

let currentLang: Language = resolveInitialLanguage();
const listeners = new Set<() => void>();

function resolveInitialLanguage(): Language {
  if (process.env.LUNAMI_LANG === 'en') {
    return 'en';
  }
  if (process.env.LUNAMI_LANG === 'ru') {
    return prefersAsciiOutput() ? 'en' : 'ru';
  }
  return prefersAsciiOutput() ? 'en' : 'ru';
}

export function getLang(): Language {
  return currentLang;
}

export function subscribeToLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLang(): Language {
  const [lang, setLang] = useState(getLang());
  useEffect(() => subscribeToLang(() => setLang(getLang())), []);
  return lang;
}

export function t(key: string, ...args: unknown[]): string {
  const fallback = dictionary.ru?.[key] ?? key;
  let text = dictionary[currentLang]?.[key] ?? fallback;

  if (args.length > 0) {
    args.forEach((val, i) => {
      text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), () => String(val));
    });
  }

  return text;
}

/** Plural form of "N commands" for palette/hints. */
export function pluralCommands(count: number): string {
  const lang = getLang();

  if (lang === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return t('palette_cmd_one', count);
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return t('palette_cmd_few', count);
    }
    return t('palette_cmd_many', count);
  }

  return count === 1 ? t('palette_cmd_one', count) : t('palette_cmd_many', count);
}

export async function changeLang(lang: Language): Promise<void> {
  currentLang = lang;
  process.env.LUNAMI_LANG = lang;

  listeners.forEach((listener) => listener());

  const { readPrimaryEnvContent, writePrimaryEnvContent } = await import('../envConfig.js');
  let content = await readPrimaryEnvContent();
  content = upsertEnvLine(content, 'LUNAMI_LANG', lang);
  await writePrimaryEnvContent(content);
}

