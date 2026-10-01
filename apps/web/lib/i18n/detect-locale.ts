import { isLocale, type Locale, routing } from './routing';

/**
 * Countries (ISO 3166-1 alpha-2, as sent by the CDN in `cf-ipcountry`) whose
 * visitors get Portuguese. We only ship `pt-BR`, so every Lusophone country
 * maps to it.
 */
const countryLocales: Record<string, Locale> = {
  BR: 'pt-BR',
  PT: 'pt-BR',
  AO: 'pt-BR',
  MZ: 'pt-BR',
  CV: 'pt-BR',
  GW: 'pt-BR',
  ST: 'pt-BR',
  TL: 'pt-BR',
};

export function localeFromCountry(
  country: string | null | undefined,
): Locale | undefined {
  if (!country) return undefined;
  return countryLocales[country.trim().toUpperCase()];
}

/**
 * Picks the best supported locale from an `Accept-Language` header: tags are
 * tried by descending quality, first as an exact match (`pt-BR`), then by
 * primary language (`pt-PT` or `pt` → `pt-BR`, `en-US` → `en`).
 */
export function localeFromAcceptLanguage(
  header: string | null | undefined,
): Locale | undefined {
  if (!header) return undefined;

  const tags = header
    .split(',')
    .map((part, index) => {
      const [rawTag = '', ...params] = part.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: rawTag.trim().toLowerCase(), quality, index };
    })
    .filter(
      ({ tag, quality }) =>
        tag !== '' && tag !== '*' && Number.isFinite(quality) && quality > 0,
    )
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of tags) {
    const exact = routing.locales.find(
      (locale) => locale.toLowerCase() === tag,
    );
    if (exact) return exact;

    const language = tag.split('-')[0];
    const byLanguage = routing.locales.find(
      (locale) => locale.toLowerCase().split('-')[0] === language,
    );
    if (byLanguage) return byLanguage;
  }

  return undefined;
}

type LocaleSignals = {
  cookie: string | null | undefined;
  country: string | null | undefined;
  acceptLanguage: string | null | undefined;
};

/**
 * Locale for a request without a locale prefix, in the order documented in
 * apps/web/AGENTS.md: previous choice → location → browser → default.
 */
export function detectLocale({
  cookie,
  country,
  acceptLanguage,
}: LocaleSignals): Locale {
  if (isLocale(cookie)) return cookie;
  return (
    localeFromCountry(country) ??
    localeFromAcceptLanguage(acceptLanguage) ??
    routing.defaultLocale
  );
}
