import { getTranslations } from 'next-intl/server';

import { NoticeMessage } from '@/components/notice-message';

/** Unknown artist ID: a real 404 with a translated explanation. */
export default async function ArtistNotFound() {
  const t = await getTranslations('artists');

  return (
    <NoticeMessage
      title={t('notFound.title')}
      description={t('notFound.description')}
    />
  );
}
