import { notFound } from 'next/navigation';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { type ReactNode, Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { getTrackCollection } from '../queries';
import type { TrackCollection } from '../track-collection';
import { MoreTracks } from './more-tracks';
import { TrackGridSkeleton } from './track-card-skeleton';
import { TrackGrid } from './track-grid';

// Two rows on desktop; enough to fill the first screen elsewhere.
const SKELETON_CARDS = 12;

function Header({ children }: { children: ReactNode }) {
  return <header className="flex flex-col gap-2">{children}</header>;
}

/** Same lines as the header and the first rows of cards. */
function TrackCollectionSkeleton() {
  const t = useTranslations('tracks.collection');

  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-10 md:gap-12"
    >
      <Header>
        <Skeleton className="my-0.5 h-3 w-16 rounded-md" />
        <Skeleton className="my-0.5 h-9 w-72 max-w-full rounded-md" />
        <Skeleton className="my-0.5 h-5 w-40 rounded-md" />
      </Header>
      <TrackGridSkeleton count={SKELETON_CARDS} />
    </div>
  );
}

async function TrackCollectionContent({
  collection,
}: {
  collection: Promise<TrackCollection>;
}) {
  const resolved = await collection;
  const data = await getTrackCollection(resolved);
  if (!data) notFound();

  const [t, { tracks }] = await Promise.all([
    getTranslations('tracks.collection'),
    getMessages(),
  ]);
  const { owner, firstPage } = data;

  return (
    <>
      <Header>
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {resolved.kind === 'artist' ? t('artist') : t('album')}
        </p>
        <h1 className="font-extrabold text-4xl tracking-tight">{owner.name}</h1>
        <p className="text-muted-foreground">
          {t('trackCount', { count: owner.trackCount })}
        </p>
      </Header>
      {firstPage.items.length > 0 && (
        <section className="flex flex-col gap-4">
          {/* Cards title with h3: the grid needs its own level under h1. */}
          <h2 className="sr-only">{t('songs')}</h2>
          <TrackGrid tracks={firstPage.items} first />
          {firstPage.nextCursor && (
            // Only the extra pages render on the client, and only they
            // need the card and list messages there.
            <NextIntlClientProvider messages={{ tracks }}>
              <MoreTracks collection={resolved} cursor={firstPage.nextCursor} />
            </NextIntlClientProvider>
          )}
        </section>
      )}
    </>
  );
}

/**
 * An artist's or album's page: its name and track count over a grid of its
 * tracks (infinite scroll). The frame is static; everything that depends on
 * the ID streams in behind a skeleton of the same size.
 */
export function TrackCollectionPage({
  collection,
}: {
  /** From the route's `params`, awaited inside the Suspense boundary. */
  collection: Promise<TrackCollection>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 md:gap-12 md:px-6">
      <Suspense fallback={<TrackCollectionSkeleton />}>
        <TrackCollectionContent collection={collection} />
      </Suspense>
    </div>
  );
}
