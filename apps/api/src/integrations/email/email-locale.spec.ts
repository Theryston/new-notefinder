import { resolveEmailLocale } from './email-locale.js';

describe('resolveEmailLocale', () => {
  it.each([
    [undefined, 'en'],
    [null, 'en'],
    ['', 'en'],
    ['pt-BR', 'pt-BR'],
    ['pt-PT,pt;q=0.9', 'pt-BR'],
    ['PT', 'pt-BR'],
    ['en-US,en;q=0.9', 'en'],
    ['pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7', 'pt-BR'],
    ['en;q=0.5, pt-BR;q=0.8', 'pt-BR'],
    ['en, pt-BR', 'en'],
    ['fr-FR,fr;q=0.9,pt;q=0.5', 'pt-BR'],
    ['fr-FR,de;q=0.9', 'en'],
    ['pt-BR;q=0, en', 'en'],
    ['*', 'en'],
    ['pt-BR;q=abc', 'en'],
  ])('maps %j to %s', (header, expected) => {
    expect(resolveEmailLocale(header)).toBe(expected);
  });
});
