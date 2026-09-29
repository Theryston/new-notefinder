import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { TermsDocument } from '@/features/terms/components/terms-document';
import { TermsShell } from '@/features/terms/components/terms-shell';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('terms');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: localeAlternates(await getLocale(), '/terms'),
  };
}

export default function TermsPage() {
  return (
    <TermsShell>
      <TermsDocument />
    </TermsShell>
  );
}
