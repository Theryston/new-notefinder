import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { AdminBenefitsPage } from '@/features/admin-benefits/components/admin-benefits-page';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('adminBenefits');
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false },
    alternates: localeAlternates(await getLocale(), '/admin/benefits'),
  };
}

export default function AdminBenefitsRoute() {
  return <AdminBenefitsPage />;
}
