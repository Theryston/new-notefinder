'use client';

import { useTranslations } from 'next-intl';

import { TrackCardGrid } from '@/features/tracks/components/track-card-grid';
import { TrackCardSkeleton } from '@/features/tracks/components/track-card-skeleton';

const PLACEHOLDERS = Array.from(
  { length: 14 },
  (_, index) => `skeleton-${index}`,
);

/**
 * Stand-in while results fetch: the shared cover grid filled with the
 * shared card placeholders, so typing never moves the layout.
 */
export function SearchSkeleton() {
  const t = useTranslations('search');

  return (
    <div role="status" aria-label={t('loading')}>
      <TrackCardGrid>
        {PLACEHOLDERS.map((key) => (
          <TrackCardSkeleton key={key} />
        ))}
      </TrackCardGrid>
    </div>
  );
}
