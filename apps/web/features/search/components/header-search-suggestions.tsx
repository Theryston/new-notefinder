'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type { SearchResultItem } from '@notefinder/contracts';
import { SearchIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type MouseEvent, type RefObject, useState } from 'react';
import { TrackCoverPlaceholder } from '@/features/tracks/components/track-cover-placeholder';
import { useFullscreenContainer } from '@/hooks/use-fullscreen-container';
import { Link } from '@/lib/i18n/navigation';

import { useSearchSuggestions } from '../hooks/use-search-suggestions';
import { searchHref } from '../search-href';
import { normalizeSearchQuery } from '../search-params';
import { toTrackCardProps } from '../search-result-to-track-card';
import { HEADER_SUGGESTIONS_LISTBOX_ID } from './header-search-bar';

/**
 * A `mousedown` on a row must not blur the field: the blur would close the
 * list before the click lands and its navigation is lost. Preventing the
 * default keeps the focus (and the list) until the click navigates. Touch
 * taps synthesize the same mouse events, so they are covered too.
 */
function keepFieldFocused(event: MouseEvent) {
  event.preventDefault();
}

const ROW_CLASS =
  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50';

/** One suggestion: the cover (or its placeholder), title and artist credit. */
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
    <span className="relative block size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {showArt ? (
        <Image
          src={coverArtUrl}
          alt=""
          fill
          sizes="48px"
          className="object-cover"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <TrackCoverPlaceholder seed={placeholderSeed} />
      )}
    </span>
  );
}

function SuggestionText({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-semibold text-sm">{title}</span>
      <span className="truncate font-medium text-muted-foreground text-xs">
        {subtitle}
      </span>
    </span>
  );
}

/**
 * One matching Recording. A Recording that already has a Track links to its
 * Track page; one without stays static until its own change wires the
 * request and sign-in flows. The typed text is never highlighted: matching
 * comes from the catalog's search engine, which forgives accents and typos,
 * so client-side highlighting would be wrong.
 */
function SuggestionRow({
  result,
  onNavigate,
}: {
  result: SearchResultItem;
  onNavigate: () => void;
}) {
  const card = toTrackCardProps(result);
  const body = (
    <>
      <SuggestionCover
        coverArtUrl={card.coverArtUrl}
        placeholderSeed={card.placeholderSeed}
      />
      <SuggestionText title={card.title} subtitle={card.subtitle} />
    </>
  );

  if (card.trackId) {
    return (
      <Link
        href={`/tracks/${card.trackId}`}
        role="option"
        aria-selected="false"
        onMouseDown={keepFieldFocused}
        onClick={onNavigate}
        className={`${ROW_CLASS} hover:bg-foreground/10`}
      >
        {body}
      </Link>
    );
  }
  // No Track yet: static until its own change wires the request and sign-in
  // flows, so it carries no option role meanwhile.
  return <div className={ROW_CLASS}>{body}</div>;
}

/** The trailing row: the full search with the normalized query. */
function SearchForRow({
  query,
  onNavigate,
}: {
  query: string;
  onNavigate: () => void;
}) {
  const t = useTranslations('header.search');
  const href = searchHref(query);
  if (!href) return null;

  return (
    <Link
      href={href}
      role="option"
      aria-selected="false"
      onMouseDown={keepFieldFocused}
      onClick={onNavigate}
      className={`${ROW_CLASS} min-h-12 font-medium text-sm hover:bg-foreground/10`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center">
        <SearchIcon className="size-4 text-muted-foreground" />
      </span>
      <span className="truncate">
        {t('searchFor', { query: normalizeSearchQuery(query) })}
      </span>
    </Link>
  );
}

/**
 * The rows: the matches in rank order, or the No-songs-found line while an
 * answered query has none (a query still loading shows no line, only the
 * Search-for row below), always followed by the trailing Search-for row.
 */
function SuggestionsList({
  suggestions,
  isPending,
  query,
  onNavigate,
}: {
  suggestions: SearchResultItem[] | undefined;
  isPending: boolean;
  query: string;
  onNavigate: () => void;
}) {
  const t = useTranslations('header.search');
  const showEmpty = !isPending && (suggestions?.length ?? 0) === 0;

  return (
    <div
      role="listbox"
      id={HEADER_SUGGESTIONS_LISTBOX_ID}
      aria-label={t('suggestions')}
      className="flex max-h-[min(28rem,60dvh)] flex-col overflow-y-auto"
    >
      {showEmpty ? (
        <p className="px-3 py-4 text-center text-muted-foreground text-sm">
          {t('noResults')}
        </p>
      ) : (
        suggestions?.map((result) => (
          <SuggestionRow
            key={result.mbid}
            result={result}
            onNavigate={onNavigate}
          />
        ))
      )}
      <SearchForRow query={query} onNavigate={onNavigate} />
    </div>
  );
}

export type HeaderSearchSuggestionsProps = {
  /** The bar the list hangs under; clicks inside it never dismiss the list. */
  anchor: () => Element | null;
  /** Lets the field tell a Tab onto a row from a blur anywhere else. */
  contentRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  /** The raw field value; the hook debounces it and the row normalizes it. */
  query: string;
  onDismiss: () => void;
  /** A row navigated: release the field like a submit does. */
  onNavigate: () => void;
};

/**
 * The header autocomplete list, everywhere except the search page: up to 6
 * Recordings in the same rank order as the full search, plus a trailing
 * Search-for row. An empty match shows a No-songs-found line with the
 * Search-for row, so the full search (e.g. by Lyrics) stays reachable.
 * Built on the popover primitive: a glass `rounded-xl` surface that hangs
 * under the bar and spans its width, including the full expanded bar on
 * small screens.
 *
 * Loaded on demand (see `HeaderSearch`): the suggestions query pulls the
 * contracts runtime into this chunk, which stays out of first-load JS.
 */
export function HeaderSearchSuggestions({
  anchor,
  contentRef,
  open,
  query,
  onDismiss,
  onNavigate,
}: HeaderSearchSuggestionsProps) {
  const container = useFullscreenContainer();
  // The search page never mounts this component: there the grid already
  // shows the matches, so a second fetch would only repeat them. A blank
  // never opens the list, so the query is always enabled here.
  const suggestions = useSearchSuggestions(query);
  const results = suggestions.data?.results;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(value, details) => {
        if (value) return;
        // Clicks in the field (focus, cursor moves) reach here as outside
        // presses; the field's own focus reopens the list, so only presses
        // truly outside dismiss it.
        const target = details.event?.target;
        if (target instanceof Element && anchor()?.contains(target)) return;
        onDismiss();
      }}
    >
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={8}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            ref={contentRef}
            initialFocus={false}
            finalFocus={false}
            className="glass data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 z-50 flex w-(--anchor-width) origin-(--transform-origin) flex-col rounded-xl p-1 text-foreground text-sm outline-hidden duration-200 data-closed:animate-out data-open:animate-in"
          >
            <SuggestionsList
              suggestions={results}
              isPending={suggestions.isPending}
              query={query}
              onNavigate={onNavigate}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
