'use client';

import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { isLocale, routing } from '@/lib/i18n/routing';

import { SegmentedControl } from './segmented-control';

// Language codes, not user-facing prose: the buttons are named in full.
const codes = { en: 'EN', 'pt-BR': 'PT' } as const;

/**
 * The current locale and how to change it: same page and query in the other
 * locale; next-intl remembers the choice in the locale cookie that
 * `proxy.ts` reads.
 */
export function useSetLocale() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return {
    locale,
    setLocale: (next: string) => {
      if (!isLocale(next) || next === locale) return;
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    },
  };
}

/** The language as a two-option segmented control (the site footer). */
export function LanguageSwitcher() {
  const t = useTranslations('header.preferences');
  const { locale, setLocale } = useSetLocale();

  return (
    <SegmentedControl
      label={t('language')}
      value={locale}
      onChange={setLocale}
      buttonClassName="px-2.5 font-semibold text-[0.8125rem]"
      options={routing.locales.map((value) => ({
        value,
        lang: value,
        label: t(`languages.${value}`),
        content: codes[value],
      }))}
    />
  );
}
