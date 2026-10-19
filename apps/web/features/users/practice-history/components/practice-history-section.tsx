import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';
import { getPracticeHistoryFirstPage } from '../practice-history-first-page';
import { PracticeHistoryList } from './practice-history-list';

/**
 * The practice history section of a Profile. Its first page is read on each
 * request (inside a Suspense boundary in the page), and the list it hydrates
 * into reads the rest in the browser. The list's strings come from the
 * `profileHistory` block, the only namespace this client tree receives.
 */
export async function PracticeHistorySection({
  username,
}: {
  username: string;
}) {
  const [t, { profileHistory }, initialPage] = await Promise.all([
    getTranslations('profileHistory'),
    getMessages(),
    getPracticeHistoryFirstPage(username),
  ]);

  return (
    <section
      aria-labelledby="profile-history-title"
      className="flex flex-col gap-4"
    >
      <h2 id="profile-history-title" className="font-bold text-xl">
        {t('title')}
      </h2>
      <NextIntlClientProvider messages={{ profileHistory }}>
        <PracticeHistoryList username={username} initialPage={initialPage} />
      </NextIntlClientProvider>
    </section>
  );
}

/** Stand-in rows while the first page loads; the keys only need to be distinct. */
const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

/** The section's stand-in while its first page loads: the title and five rows. */
export async function PracticeHistorySkeleton() {
  const t = await getTranslations('profileHistory');
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-7 w-48 rounded-md" />
      {SKELETON_ROWS.map((row) => (
        <div key={row} className="flex items-center gap-3 p-2">
          <Skeleton className="size-14 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
