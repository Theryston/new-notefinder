'use client';

import type { SearchResultItem } from '@notefinder/contracts';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MouseEvent, ReactNode, RefObject } from 'react';

import { Popover, PopoverContent } from '@/components/ui/popover';
import { Toaster } from '@/components/ui/sonner';
import { Spinner } from '@/components/ui/spinner';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { RequestTrackAction } from '@/features/tracks/components/request-track-action';
import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { Link } from '@/lib/i18n/navigation';

import { useSearchSuggestions } from '../hooks/use-search-suggestions';
import { searchPathFrom, signInToRequestHref } from '../request-sign-in';
import { searchHref } from '../search-href';
import { normalizeSearchQuery } from '../search-params';
import { type ResultViewer, resultAction } from '../search-result-action';
import { toTrackCardProps } from '../search-result-to-track-card';
import { suggestionPanelContent } from '../suggestion-panel';

/** A row is at least 56px tall (DESIGN.md: list rows). */
const ROW_CLASS =
  'flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
const LINK_ROW_CLASS = `${ROW_CLASS} transition-colors duration-150 ease-out hover:bg-foreground/10`;
const BUTTON_ROW_CLASS = `${LINK_ROW_CLASS} w-full text-left disabled:cursor-progress`;

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
 * The trailing chip of a row without a Track: "No notes yet", or the spinner
 * and "Generating…" while its request is on its way (the card's feedback).
 */
function NoNotesMarker({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
      {pending ? <Spinner className="size-3" /> : null}
      {label}
    </span>
  );
}

/**
 * A Recording without a Track that a signed-in visitor with a username can
 * request: a click asks for its notes, the same request the search card
 * fires. Once the Track exists the field lets go of the query, as a pick does
 * (the request then navigates to the Processing page).
 */
function RequestSuggestionRow({
  item,
  content,
  onPickTrack,
}: {
  item: SearchResultItem;
  /** The cover and the title, as the row shows them. */
  content: ReactNode;
  onPickTrack: () => void;
}) {
  const t = useTranslations('header.search.suggestions');
  return (
    <RequestTrackAction recordingMbid={item.mbid} onRequested={onPickTrack}>
      {({ pending, onRequest }) => (
        <button
          type="button"
          aria-busy={pending}
          aria-label={t('generateLabel', { title: item.title })}
          disabled={pending}
          onClick={onRequest}
          className={BUTTON_ROW_CLASS}
        >
          {content}
          <NoNotesMarker
            pending={pending}
            label={pending ? t('generating') : t('noNotesYet')}
          />
        </button>
      )}
    </RequestTrackAction>
  );
}

/**
 * One Recording row. With a Track it is a link to that Track page, and a pick
 * clears the field (the next page should not reopen the old query). Without a
 * Track the row follows the result card: a signed-in visitor with a username
 * requests the notes, a signed-out one goes to sign in first and comes back to
 * `searchPath` with the request marker, anyone else sees a static row. Every
 * row without a Track shows the "No notes yet" marker.
 */
function SuggestionRow({
  item,
  user,
  searchPath,
  onPickTrack,
}: {
  item: SearchResultItem;
  user: ResultViewer;
  searchPath: string;
  onPickTrack: () => void;
}) {
  const t = useTranslations('header.search.suggestions');
  const card = toTrackCardProps(item);
  const content = (
    <>
      <SuggestionCover
        coverArtUrl={card.coverArtUrl}
        placeholderSeed={card.placeholderSeed}
      />
      <SuggestionText title={card.title} subtitle={card.subtitle} />
    </>
  );
  if (card.trackId !== null) {
    return (
      <Link
        href={`/tracks/${card.trackId}`}
        onClick={onPickTrack}
        className={LINK_ROW_CLASS}
      >
        {content}
      </Link>
    );
  }
  const action = resultAction(item, user);
  if (action === 'request') {
    return (
      <RequestSuggestionRow
        item={item}
        content={content}
        onPickTrack={onPickTrack}
      />
    );
  }
  const marker = <NoNotesMarker pending={false} label={t('noNotesYet')} />;
  if (action === 'sign-in') {
    return (
      <Link
        href={signInToRequestHref(searchPath, item.mbid)}
        aria-label={t('signInLabel', { title: card.title })}
        className={LINK_ROW_CLASS}
      >
        {content}
        {marker}
      </Link>
    );
  }
  return (
    <div className={ROW_CLASS}>
      {content}
      {marker}
    </div>
  );
}

/**
 * The header suggestions: up to six Recordings in catalog rank order, then
 * the trailing "Search for" row that goes to the full search. A settled empty
 * answer adds a "No songs found" line above the same row (the full search
 * still answers lyrics). The panel is anchored to the search bar, full width
 * on small screens.
 *
 * Rows with a Track are links, rows without one are sign-in links or request
 * buttons (see `SuggestionRow`). A press on the panel never moves focus, so
 * the field does not blur (which would close the panel) before the click lands.
 */
export function HeaderSuggestions({
  query,
  anchor,
  onPickTrack,
  onPickSearch,
}: {
  query: string;
  anchor: RefObject<Element | null>;
  onPickTrack: () => void;
  onPickSearch: () => void;
}) {
  const t = useTranslations('header.search.suggestions');
  const { data } = useSearchSuggestions(query);
  const { items, noSongs } = suggestionPanelContent(data?.results);
  const searchForHref = searchHref(query);
  // The sign-in round trip returns to this search, as the search page has it.
  const searchPath = searchPathFrom(normalizeSearchQuery(query), null);

  return (
    <>
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
          <SessionUserBoundary
            render={(user) => (
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.mbid}>
                    <SuggestionRow
                      item={item}
                      user={user}
                      searchPath={searchPath}
                      onPickTrack={onPickTrack}
                    />
                  </li>
                ))}
                {noSongs ? (
                  <li className={`${ROW_CLASS} text-muted-foreground text-sm`}>
                    {t('noSongs')}
                  </li>
                ) : null}
                {searchForHref ? (
                  <li>
                    <Link
                      href={searchForHref}
                      onClick={onPickSearch}
                      className={`${LINK_ROW_CLASS} font-medium text-sm`}
                    >
                      <SearchIcon aria-hidden="true" className="size-4" />
                      {t('searchFor', { query: searchForHref.query.q })}
                    </Link>
                  </li>
                ) : null}
              </ul>
            )}
          />
        </PopoverContent>
      </Popover>
      {/* A failed request reports by toast, and the home page mounts no Toaster. */}
      <Toaster />
    </>
  );
}
