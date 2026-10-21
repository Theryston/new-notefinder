import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { HomeFeed } from '@/features/home/components/home-feed';
import { HomeFeedSkeleton } from '@/features/home/components/home-feed-skeleton';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale(), '/') };
}

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-extrabold text-3xl tracking-tight md:text-4xl">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{t('description')}</p>
      </header>
      <Suspense fallback={<HomeFeedSkeleton />}>
        <HomeFeed />
      </Suspense>
    </div>
  );
}
