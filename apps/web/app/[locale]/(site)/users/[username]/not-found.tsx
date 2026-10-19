import { getTranslations } from 'next-intl/server';

import { NotFoundNotice } from '@/components/not-found-notice';

/** Unknown username: a real 404 with a translated explanation. */
export default async function UserProfileNotFound() {
  const t = await getTranslations('publicProfile');

  return (
    <NotFoundNotice
      title={t('notFound.title')}
      description={t('notFound.description')}
    />
  );
}
