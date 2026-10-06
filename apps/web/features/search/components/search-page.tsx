import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { SearchSkeleton } from './search-skeleton';
import { SearchView } from './search-view';

/**
 * Frame of `/search`: the static heading plus the live search, which reads
 * `q` and `scope` from the URL and therefore renders inside Suspense. The
 * `search` messages are added here, only on this page.
 */
export async function SearchPage() {
  const t = await getTranslations('search');
  const { errors, search } = await getMessages();

  return (
    <div className="flex flex-col gap-4 py-6 md:py-8">
      <h1 className="font-extrabold text-4xl tracking-tight">{t('title')}</h1>
      <NextIntlClientProvider messages={{ errors, search }}>
        <Suspense fallback={<SearchSkeleton />}>
          <SearchView />
        </Suspense>
      </NextIntlClientProvider>
    </div>
  );
}
