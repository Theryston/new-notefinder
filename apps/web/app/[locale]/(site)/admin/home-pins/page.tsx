import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { AdminHomePinsPage } from '@/features/admin-home-pins/components/admin-home-pins-page';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('adminHomePins');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/admin/home-pins'),
    // Private: only admins ever see it.
    robots: { index: false },
  };
}

export default function AdminHomePinsRoute() {
  return <AdminHomePinsPage />;
}
