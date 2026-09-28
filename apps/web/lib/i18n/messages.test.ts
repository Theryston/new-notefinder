import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { apiErrorCodeSchema } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

import { routing } from './routing';

type Messages = { [key: string]: string | Messages };

function loadMessages(locale: string): Messages {
  const path = join(import.meta.dirname, '../../messages', `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Dot-separated path of every leaf message, e.g. `home.title`. */
function flatten(messages: Messages, prefix = ''): Map<string, unknown> {
  const leaves = new Map<string, unknown>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      for (const [leaf, text] of flatten(value, path)) leaves.set(leaf, text);
    } else {
      leaves.set(path, value);
    }
  }
  return leaves;
}

// `en` is the source of truth: `check-types` catches a key used in code that
// is missing from it, but nothing else catches a key missing from another
// locale, which next-intl would only report at runtime.
const source = flatten(loadMessages('en'));

describe.each(routing.locales)('%s messages', (locale) => {
  const messages = flatten(loadMessages(locale));

  it('has exactly the keys of en', () => {
    expect([...messages.keys()].sort()).toEqual([...source.keys()].sort());
  });

  it('has only non-empty strings', () => {
    const invalid = [...messages].filter(
      ([, text]) => typeof text !== 'string' || text.trim() === '',
    );
    expect(invalid).toEqual([]);
  });

  it('translates every API error code', () => {
    const missing = apiErrorCodeSchema.options.filter(
      (code) => !messages.has(`errors.${code}`),
    );
    expect(missing).toEqual([]);
  });
});
