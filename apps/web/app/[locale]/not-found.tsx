import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { Container } from '@/components/container';
import { NotFoundView } from '@/components/not-found-view';

/** Unknown route under a locale: a real 404 with translated actions. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notFound');

  return {
    title: t('metaTitle'),
    description: t('description'),
  };
}

export default async function LocaleNotFound() {
  const t = await getTranslations('notFound');
  const locale = await getLocale();

  return (
    <Container>
      <NotFoundView
        title={t('title')}
        description={t('description')}
        homeLabel={t('home')}
        searchLabel={t('search')}
        homeHref={`/${locale}`}
        searchHref={`/${locale}/search`}
      />
    </Container>
  );
}
