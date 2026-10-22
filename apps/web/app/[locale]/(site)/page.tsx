import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { HomeFeed } from '@/features/home/components/home-feed';
import { HomeFeedSkeleton } from '@/features/home/components/home-feed-skeleton';
import { localeAlternates } from '@/lib/i18n/metadata';

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale(), '/') };
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFeedSkeleton />}>
      <HomeFeed />
    </Suspense>
  );
}
