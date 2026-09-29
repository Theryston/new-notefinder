import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { EditProfilePage } from '@/features/auth/components/edit-profile-page';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile.edit');

  return {
    title: t('metaTitle'),
    alternates: localeAlternates(await getLocale(), '/me/edit'),
    // Private: the content is the signed-in user's own.
    robots: { index: false },
  };
}

export default function EditProfileRoute() {
  return <EditProfilePage />;
}
