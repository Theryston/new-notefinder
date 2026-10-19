import { getTranslations } from 'next-intl/server';

import { NotFoundNotice } from '@/components/not-found-notice';

/** Unknown artist ID: a real 404 with a translated explanation. */
export default async function ArtistNotFound() {
  const t = await getTranslations('artists');

  return (
    <NotFoundNotice
      title={t('notFound.title')}
      description={t('notFound.description')}
    />
  );
}
