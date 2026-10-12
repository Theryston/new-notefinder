import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { durationParts } from './duration-parts';

const messagesOf = (locale: string) =>
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../messages', `${locale}.json`),
      'utf8',
    ),
  );

describe('durationParts', () => {
  it('splits a length into hours, minutes and seconds', () => {
    expect(durationParts(188_000)).toEqual({
      hours: 0,
      minutes: 3,
      seconds: 8,
    });
    expect(durationParts(3_725_000)).toEqual({
      hours: 1,
      minutes: 2,
      seconds: 5,
    });
  });

  it('rounds to the nearest second', () => {
    expect(durationParts(59_600)).toEqual({ hours: 0, minutes: 1, seconds: 0 });
  });

  it('never goes below zero', () => {
    expect(durationParts(-5)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});

describe.each(['en', 'pt-BR'] as const)(
  'the duration messages (%s)',
  (locale) => {
    const t = createTranslator({
      locale,
      messages: messagesOf(locale),
      namespace: 'tracks.practice',
    });

    it('write the clock with zero-padded seconds', () => {
      expect(t('durationShort', { minutes: 3, seconds: 8 })).toBe('3:08');
    });

    it('add the hours, and pad the minutes, past an hour', () => {
      expect(t('durationLong', { hours: 1, minutes: 2, seconds: 5 })).toBe(
        '1:02:05',
      );
    });
  },
);
