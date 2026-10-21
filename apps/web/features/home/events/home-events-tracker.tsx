'use client';

import type { HomeFeedPage } from '@notefinder/contracts';
import { useMemo } from 'react';
import type { TrackedHomePage, TrackedHomeRow } from './tracked-rows';
import { useHomeEvents } from './use-home-events';

const trackedPages = (pages: HomeFeedPage[]): TrackedHomePage[] =>
  pages.map((page) => ({
    version: page.version,
    algorithmVersion: page.algorithmVersion,
    rows: page.rows.map(
      (row): TrackedHomeRow => ({
        id: row.id,
        items:
          row.layout === 'hero'
            ? [{ id: row.track.id }]
            : // The daily-target strip and the entity rows (genres, artists,
              // albums) carry no Tracks, so there is nothing to track:
              // recordRowImpression returns early on an empty items list,
              // making this a no-op for those layouts.
              row.layout === 'daily-target' ||
                row.layout === 'genres' ||
                row.layout === 'artists' ||
                row.layout === 'albums'
              ? []
              : row.items.map((item) => ({ id: item.id })),
      }),
    ),
  }));

/**
 * The home's engagement instrumentation: row impressions and card clicks,
 * sent to `POST /v1/events` in batches. Renders nothing; the row wrapper
 * carries the row id and the layouts the card attributes this reads.
 */
export function HomeEventsTracker({ pages }: { pages: HomeFeedPage[] }) {
  const tracked = useMemo(() => trackedPages(pages), [pages]);
  useHomeEvents(tracked);
  return null;
}
