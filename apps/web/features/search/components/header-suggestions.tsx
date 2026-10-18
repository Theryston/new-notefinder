'use client';

import { SearchIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { MouseEvent, RefObject } from 'react';
import { useState } from 'react';

import { Popover, PopoverContent } from '@/components/ui/popover';
import type { TrackCardProps } from '@/features/tracks/components/track-card';
import { TrackCoverPlaceholder } from '@/features/tracks/components/track-cover-placeholder';
import { Link } from '@/lib/i18n/navigation';

import { useSearchSuggestions } from '../hooks/use-search-suggestions';
import { searchHref } from '../search-href';
import { toTrackCardProps } from '../search-result-to-track-card';
import { suggestionPanelContent } from '../suggestion-panel';

const ROW_CLASS =
  'flex items-center gap-3 rounded-lg px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
const LINK_ROW_CLASS = `${ROW_CLASS} hover:bg-foreground/10`;

/** The square cover of a row: the art, or the placeholder without one. */
function SuggestionCover({
  coverArtUrl,
  placeholderSeed,
}: {
  coverArtUrl?: string | null;
  placeholderSeed: string;
}) {
  const [artFailed, setArtFailed] = useState(false);
  const showArt = coverArtUrl && !artFailed;

  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
      {showArt ? (
        <Image
          src={coverArtUrl}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <TrackCoverPlaceholder seed={placeholderSeed} />
      )}
    </span>
  );
}

/** Title and artist credit, so same-title Recordings can be told apart. */
function SuggestionText({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-sm">{title}</span>
      <span className="truncate text-muted-foreground text-xs">{subtitle}</span>
    </span>
  );
}

/**
 * One Recording row. With a Track it is a link to that Track page; without
 * one it is static for now (the "generate notes" action comes with the
 * no-Track rows).
 */
function SuggestionRow({
  card,
  onPick,
}: {
  card: TrackCardProps;
  onPick: () => void;
}) {
  const content = (
    <>
      <SuggestionCover
        coverArtUrl={card.coverArtUrl}
        placeholderSeed={card.placeholderSeed}
      />
      <SuggestionText title={card.title} subtitle={card.subtitle} />
    </>
  );
  if (card.trackId === null) {
    return <div className={ROW_CLASS}>{content}</div>;
  }
  return (
    <Link
      href={`/tracks/${card.trackId}`}
      onClick={onPick}
      className={LINK_ROW_CLASS}
    >
      {content}
    </Link>
  );
}

/**
 * The header suggestions: up to six Recordings in catalog rank order, then
 * the trailing "Search for" row that goes to the full search. A settled empty
 * answer adds a "No songs found" line above the same row (the full search
 * still answers lyrics). The panel is anchored to the search bar, full width
 * on small screens.
 *
 * Its rows are links, and a press on the panel never moves focus, so the
 * field does not blur (which would close the panel) before the click lands.
 */
export function HeaderSuggestions({
  query,
  anchor,
  onPick,
}: {
  query: string;
  anchor: RefObject<Element | null>;
  onPick: () => void;
}) {
  const t = useTranslations('header.search.suggestions');
  const { data } = useSearchSuggestions(query);
  const { items, noSongs } = suggestionPanelContent(data?.results);
  const searchFor = searchHref(query);

  return (
    <Popover open>
      <PopoverContent
        anchor={anchor}
        initialFocus={false}
        finalFocus={false}
        role="group"
        aria-label={t('label')}
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        className="max-h-96 w-(--anchor-width) gap-0 overflow-y-auto rounded-xl p-1"
      >
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.mbid}>
              <SuggestionRow card={toTrackCardProps(item)} onPick={onPick} />
            </li>
          ))}
          {noSongs ? (
            <li className={`${ROW_CLASS} text-muted-foreground text-sm`}>
              {t('noSongs')}
            </li>
          ) : null}
          {searchFor ? (
            <li>
              <Link
                href={searchFor}
                onClick={onPick}
                className={`${LINK_ROW_CLASS} font-medium text-sm`}
              >
                <SearchIcon aria-hidden="true" className="size-4" />
                {t('searchFor', { query: searchFor.query.q })}
              </Link>
            </li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
