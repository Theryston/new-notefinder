import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import ptBR from '../../messages/pt-BR.json';

const views = (locale: 'en' | 'pt-BR', count: number) =>
  createTranslator({
    locale,
    messages: locale === 'en' ? en : ptBR,
    namespace: 'tracks.practice',
  })('views', { count });

describe('the view count message', () => {
  it.each([
    [0, '0 views'],
    [1, '1 view'],
    [2, '2 views'],
    [1234, '1,234 views'],
  ])('reads %i in English as "%s"', (count, text) => {
    expect(views('en', count)).toBe(text);
  });

  // CLDR puts 0 in Portuguese's `one` category, so the message names it.
  it.each([
    [0, '0 visualizações'],
    [1, '1 visualização'],
    [2, '2 visualizações'],
    [1234, '1.234 visualizações'],
  ])('reads %i in Portuguese as "%s"', (count, text) => {
    expect(views('pt-BR', count)).toBe(text);
  });
});
