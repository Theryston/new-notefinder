'use client';

import { useTranslations } from 'next-intl';

import { SearchCardSkeleton } from './search-card-skeleton';

const PLACEHOLDERS = Array.from(
  { length: 8 },
  (_, index) => `skeleton-${index}`,
);

/**
 * Stand-in while results fetch: the same cover-grid blocks as the cards,
 * so typing never moves the layout.
 */
export function SearchSkeleton() {
  const t = useTranslations('search');

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4"
    >
      {PLACEHOLDERS.map((key) => (
        <SearchCardSkeleton key={key} />
      ))}
    </div>
  );
}
