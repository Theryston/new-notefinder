import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale } from 'next-intl/server';

import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale(), '/') };
}

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-3xl tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
    </main>
  );
}
