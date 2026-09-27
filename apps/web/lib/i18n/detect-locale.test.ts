import { describe, expect, it } from 'vitest';

import {
  detectLocale,
  localeFromAcceptLanguage,
  localeFromCountry,
} from './detect-locale';

describe('localeFromCountry', () => {
  it.each(['BR', 'PT', 'AO', 'MZ'])('maps %s to pt-BR', (country) => {
    expect(localeFromCountry(country)).toBe('pt-BR');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(localeFromCountry('br')).toBe('pt-BR');
    expect(localeFromCountry(' Br ')).toBe('pt-BR');
  });

  it('returns undefined for unmapped or missing countries', () => {
    expect(localeFromCountry('US')).toBeUndefined();
    expect(localeFromCountry('XX')).toBeUndefined();
    expect(localeFromCountry('')).toBeUndefined();
    expect(localeFromCountry(null)).toBeUndefined();
    expect(localeFromCountry(undefined)).toBeUndefined();
  });
});

describe('localeFromAcceptLanguage', () => {
  it('matches an exact tag case-insensitively', () => {
    expect(localeFromAcceptLanguage('pt-BR')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('PT-br')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('en')).toBe('en');
  });

  it('falls back to the primary language', () => {
    expect(localeFromAcceptLanguage('pt-PT')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('pt')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('en-US')).toBe('en');
  });

  it('orders tags by quality, not by position', () => {
    expect(localeFromAcceptLanguage('en;q=0.5, pt-BR;q=0.9')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('pt;q=0.4,en-GB;q=0.8')).toBe('en');
  });

  it('keeps header order between tags with the same quality', () => {
    expect(localeFromAcceptLanguage('pt-BR, en')).toBe('pt-BR');
    expect(localeFromAcceptLanguage('en;q=0.7, pt;q=0.7')).toBe('en');
  });

  it('skips unsupported languages until one matches', () => {
    expect(localeFromAcceptLanguage('fr-FR, de;q=0.9, pt;q=0.8')).toBe('pt-BR');
  });

  it('ignores the wildcard and tags with q=0', () => {
    expect(localeFromAcceptLanguage('*')).toBeUndefined();
    expect(localeFromAcceptLanguage('pt-BR;q=0, en;q=0.1')).toBe('en');
    expect(localeFromAcceptLanguage('pt;q=0, *;q=0.5')).toBeUndefined();
  });

  it('ignores tags with an invalid quality', () => {
    expect(localeFromAcceptLanguage('pt;q=abc, en;q=0.2')).toBe('en');
  });

  it('returns undefined when nothing is supported or the header is empty', () => {
    expect(localeFromAcceptLanguage('fr, de')).toBeUndefined();
    expect(localeFromAcceptLanguage('')).toBeUndefined();
    expect(localeFromAcceptLanguage(null)).toBeUndefined();
    expect(localeFromAcceptLanguage(undefined)).toBeUndefined();
  });
});

describe('detectLocale', () => {
  const none = { cookie: undefined, country: undefined, acceptLanguage: null };

  it('prefers a valid locale cookie over every other signal', () => {
    expect(
      detectLocale({ cookie: 'en', country: 'BR', acceptLanguage: 'pt-BR' }),
    ).toBe('en');
    expect(
      detectLocale({ cookie: 'pt-BR', country: 'US', acceptLanguage: 'en' }),
    ).toBe('pt-BR');
  });

  it('ignores an invalid cookie', () => {
    expect(detectLocale({ ...none, cookie: 'fr', country: 'BR' })).toBe(
      'pt-BR',
    );
    expect(detectLocale({ ...none, cookie: 'pt-br' })).toBe('en');
  });

  it('prefers the country over Accept-Language', () => {
    expect(
      detectLocale({ ...none, country: 'BR', acceptLanguage: 'en-US' }),
    ).toBe('pt-BR');
  });

  it('uses Accept-Language when the country is not mapped', () => {
    expect(
      detectLocale({ ...none, country: 'US', acceptLanguage: 'pt-BR' }),
    ).toBe('pt-BR');
  });

  it('falls back to en', () => {
    expect(detectLocale(none)).toBe('en');
    expect(
      detectLocale({ cookie: 'xx', country: 'FR', acceptLanguage: 'fr' }),
    ).toBe('en');
  });
});
