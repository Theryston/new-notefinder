/** Locales emails are written in; same set as the web app. */
export const EMAIL_LOCALES = ['en', 'pt-BR'] as const;

export type EmailLocale = (typeof EMAIL_LOCALES)[number];

const DEFAULT_EMAIL_LOCALE: EmailLocale = 'en';

// Only one Portuguese locale exists, so every `pt-*` reads pt-BR.
const localeForLanguageTag = (tag: string): EmailLocale | undefined => {
  const language = tag.toLowerCase().split('-')[0];
  if (language === 'pt') return 'pt-BR';
  if (language === 'en') return 'en';
  return undefined;
};

/**
 * Picks the email locale from an `Accept-Language` header: the supported
 * language with the highest quality value, or English when none matches.
 */
export const resolveEmailLocale = (
  acceptLanguage: string | null | undefined,
): EmailLocale => {
  if (!acceptLanguage) return DEFAULT_EMAIL_LOCALE;

  const candidates = acceptLanguage
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const quality = qParam === undefined ? 1 : Number(qParam.split('=')[1]);
      return {
        locale: localeForLanguageTag(tag.trim()),
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((candidate) => candidate.quality > 0)
    // Highest quality first; ties keep the header's order.
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  return (
    candidates.find((candidate) => candidate.locale !== undefined)?.locale ??
    DEFAULT_EMAIL_LOCALE
  );
};
