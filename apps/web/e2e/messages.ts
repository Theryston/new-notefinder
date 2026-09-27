import { readFileSync } from 'node:fs';

import type en from '../messages/en.json';

type Messages = typeof en;

// Read from disk because Playwright's ESM loader can't import JSON modules.
function load(locale: string): Messages {
  const url = new URL(`../messages/${locale}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

export const messages = { en: load('en'), 'pt-BR': load('pt-BR') } as const;
