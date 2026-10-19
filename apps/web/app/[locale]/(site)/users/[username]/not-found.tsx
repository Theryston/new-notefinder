import { getTranslations } from 'next-intl/server';

import { NoticeMessage } from '@/components/notice-message';

/** Unknown username: a real 404 with a translated explanation. */
export default async function UserProfileNotFound() {
  const t = await getTranslations('publicProfile');

  return (
    <NoticeMessage
      title={t('notFound.title')}
      description={t('notFound.description')}
    />
  );
}
