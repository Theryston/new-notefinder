import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { SearchResultsSection } from './search-results-section';
import { SearchSkeleton } from './search-skeleton';

/**
 * Frame of `/search`: the static heading, then the live results, which read
 * `q` from the URL and therefore render inside Suspense. The query
 * field itself lives in the site header. The `search` messages are added
 * here, only on this page, plus the generic `tracks` card messages the
 * result grid renders through.
 */
export async function SearchPage() {
  const t = await getTranslations('search');
  const { errors, search, tracks } = await getMessages();

  return (
    <div className="flex flex-col gap-4 pb-6 md:pb-8">
      <NextIntlClientProvider messages={{ errors, search, tracks }}>
        <h1 className="font-extrabold text-2xl tracking-tight">{t('title')}</h1>
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResultsSection />
        </Suspense>
      </NextIntlClientProvider>
    </div>
  );
}
