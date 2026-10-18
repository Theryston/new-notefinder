'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MouseEvent, RefObject } from 'react';
import { useEffect } from 'react';

import { Popover, PopoverContent } from '@/components/ui/popover';
import type { TrackCardProps } from '@/features/tracks/components/track-card';
import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { Link } from '@/lib/i18n/navigation';

import {
  SUGGESTIONS_LISTBOX_ID,
  suggestionRowId,
  suggestionRowLayout,
  suggestionRowProps,
} from '../combobox-keys';
import { useSearchSuggestions } from '../hooks/use-search-suggestions';
import { searchHref } from '../search-href';
import { toTrackCardProps } from '../search-result-to-track-card';
import { suggestionPanelContent } from '../suggestion-panel';

/**
 * A row is at least 56px tall (DESIGN.md: list rows). The highlight is the
 * keyboard's current row, shown with the same wash as the hover.
 */
const ROW_CLASS =
  'flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-highlighted:bg-foreground/10';
const LINK_ROW_CLASS = `${ROW_CLASS} transition-colors duration-150 ease-out hover:bg-foreground/10`;

type RowProps = ReturnType<typeof suggestionRowProps>;

/** The 48px square cover of a row: the art, or the placeholder without it. */
function SuggestionCover({
  coverArtUrl,
  placeholderSeed,
}: {
  coverArtUrl?: string | null;
  placeholderSeed: string;
}) {
  return (
    <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      <TrackCoverArt
        coverArtUrl={coverArtUrl}
        placeholderSeed={placeholderSeed}
        sizes="48px"
      />
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
 * One Recording option. With a Track it is a link to that Track page, and a
 * pick clears the field (the next page should not reopen the old query).
 *
 * Without a Track it is a plain option for now. Keyboard Enter on a
 * highlighted option clicks it whatever its type, so the request and sign-in
 * flows of the no-Track rows (#251) hang off the same click handler.
 */
function SuggestionRow({
  card,
  rowProps,
  onPickTrack,
}: {
  card: TrackCardProps;
  rowProps: RowProps;
  onPickTrack: () => void;
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
    return (
      <div {...rowProps} className={ROW_CLASS}>
        {content}
      </div>
    );
  }
  return (
    <Link
      {...rowProps}
      href={`/tracks/${card.trackId}`}
      onClick={onPickTrack}
      className={LINK_ROW_CLASS}
    >
      {content}
    </Link>
  );
}

/**
 * The header suggestions: up to six Recordings in catalog rank order, then
 * the trailing "Search for" option that goes to the full search. A settled
 * empty answer adds a "No songs found" line above it (the full search still
 * answers lyrics). The panel is anchored to the search bar, full width on
 * small screens.
 *
 * The rows form a listbox the field names with `aria-controls`; the highlight
 * is the field's `aria-activedescendant`. A press on the panel never moves
 * focus, so the field does not blur (which would close the panel) before the
 * click lands.
 */
export function HeaderSuggestions({
  query,
  anchor,
  highlighted,
  onRowsChange,
  onPickTrack,
  onPickSearch,
}: {
  query: string;
  anchor: RefObject<Element | null>;
  /** The row the keyboard highlights: an index, the Search-for row last. */
  highlighted: number | null;
  /** Reports the rows on screen, so the arrow keys wrap inside them. */
  onRowsChange: (count: number) => void;
  onPickTrack: () => void;
  onPickSearch: () => void;
}) {
  const t = useTranslations('header.search.suggestions');
  const { data } = useSearchSuggestions(query);
  const results = data?.results;
  const { items, noSongs } = suggestionPanelContent(results);
  const searchForHref = searchHref(query);
  const { searchForIndex } = suggestionRowLayout(items.length);

  // A new answer is a new set of rows: the list reports them so the highlight
  // starts over. The row count (Search-for included) is the layout's.
  useEffect(() => {
    onRowsChange(suggestionRowLayout(results?.length ?? 0).rowCount);
  }, [results, onRowsChange]);

  useEffect(() => {
    if (highlighted === null) return;
    document
      .getElementById(suggestionRowId(highlighted))
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  return (
    <Popover open>
      <PopoverContent
        anchor={anchor}
        initialFocus={false}
        finalFocus={false}
        role="presentation"
        onMouseDown={(event: MouseEvent) => event.preventDefault()}
        className="max-h-96 w-(--anchor-width) gap-0 overflow-y-auto rounded-xl p-1"
      >
        <div
          role="listbox"
          id={SUGGESTIONS_LISTBOX_ID}
          aria-label={t('label')}
          className="flex flex-col"
        >
          {items.map((item, index) => (
            <SuggestionRow
              key={item.mbid}
              card={toTrackCardProps(item)}
              rowProps={suggestionRowProps(index, highlighted)}
              onPickTrack={onPickTrack}
            />
          ))}
          {noSongs ? (
            <div
              role="presentation"
              className={`${ROW_CLASS} text-muted-foreground text-sm`}
            >
              {t('noSongs')}
            </div>
          ) : null}
          {searchForHref ? (
            <Link
              {...suggestionRowProps(searchForIndex, highlighted)}
              href={searchForHref}
              onClick={onPickSearch}
              className={`${LINK_ROW_CLASS} font-medium text-sm`}
            >
              <SearchIcon aria-hidden="true" className="size-4" />
              {t('searchFor', { query: searchForHref.query.q })}
            </Link>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
