import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { AdminPlansPage } from '@/features/admin-plans/components/admin-plans-page';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('adminPlans');
  return {
    title: t('title'),
    description: t('intro'),
    alternates: localeAlternates(await getLocale(), '/admin/plans'),
    robots: { index: false },
  };
}
export default function AdminPlansRoute() {
  return <AdminPlansPage />;
}
