import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { Skeleton } from '@/components/ui/skeleton';

import { getPracticeHistoryFirstPage } from '../practice-history-first-page';
import { PracticeHistoryList } from './practice-history-list';
import { PracticeHistoryRowSkeletons } from './practice-history-row-skeletons';

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

/**
 * Before the server has the first page, the section has no runs to size its
 * stand-ins from, so it shows five plain rows. The first page's real height
 * replaces them when it arrives; that is the one shift this section allows.
 */
const FALLBACK_ROWS = ['1', '2', '3', '4', '5'].map((id) => ({
  id,
  bleedSuspected: false,
}));

/** The section's stand-in while its first page loads: the title and the rows. */
export async function PracticeHistorySkeleton() {
  const t = await getTranslations('profileHistory');
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-7 w-48 rounded-md" />
      <PracticeHistoryRowSkeletons rows={FALLBACK_ROWS} />
    </div>
  );
}
