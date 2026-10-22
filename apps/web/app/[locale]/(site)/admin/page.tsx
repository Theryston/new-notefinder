import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { AdminIndexPage } from '@/features/admin/components/admin-index-page';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/admin'),
    // Private: only admins ever see it.
    robots: { index: false },
  };
}

export default function AdminRoute() {
  return <AdminIndexPage />;
}
