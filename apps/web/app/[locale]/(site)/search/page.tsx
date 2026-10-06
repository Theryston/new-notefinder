import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { SearchPage } from '@/features/search/components/search-page';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/search'),
  };
}

export default function SearchRoutePage() {
  return <SearchPage />;
}
