'use client';

import { useIsFetching } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useQueryState } from 'nuqs';
import type { FormEvent, RefObject, SetStateAction } from 'react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

import type { ComboboxEvent, ComboboxIntent } from '../combobox-state-machine';
import { headerFieldLoading } from '../header-search-loading';
import { useDebouncedQuery } from '../hooks/use-debounced-query';
import {
  type SuggestionsCombobox,
  useSuggestionsCombobox,
} from '../hooks/use-suggestions-combobox';
import { isSearchHotkey } from '../search-hotkey';
import { searchHref } from '../search-href';
import { normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from '../search-params';
import { HeaderSearchBar } from './header-search-bar';

/**
 * The suggestions panel (popover plus its query) loads on first open, so the
 * header bundle every page ships stays small.
 */
const HeaderSuggestions = dynamic(() =>
  import('./header-suggestions').then((module) => module.HeaderSuggestions),
);

/** Listens for `⌘K`/`Ctrl K` and focuses the header field. */
function useSearchHotkey(focus: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchHotkey(event)) return;
      event.preventDefault();
      focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focus]);
}

/** Mirrors `q` in the URL, adopting outside changes (back/forward). */
function useSyncedInputValue(urlQuery: string | null) {
  const [inputValue, setInputValue] = useState(urlQuery ?? '');

  useEffect(() => {
    setInputValue((current) => {
      const next = urlQuery ?? '';
      return normalizeSearchQuery(current) === normalizeSearchQuery(next)
        ? current
        : next;
    });
  }, [urlQuery]);

  return [inputValue, setInputValue] as const;
}

type LiveSearchInput = {
  inputValue: string;
  urlQuery: string | null;
  setUrlQuery: (value: string | null) => Promise<URLSearchParams>;
  isSearchPage: boolean;
};

/**
 * Debounced live search: on the search page the URL (and the fetch) follows
 * typing in place. Anywhere else typing stays on the page and only Enter
 * navigates. A blank clears `q` on the search page.
 */
function useLiveSearchNavigation({
  inputValue,
  urlQuery,
  setUrlQuery,
  isSearchPage,
}: LiveSearchInput) {
  useEffect(() => {
    if (!isSearchPage) return;
    if (normalizeSearchQuery(inputValue) === normalizeSearchQuery(urlQuery)) {
      return;
    }
    const timer = setTimeout(() => {
      const normalized = normalizeSearchQuery(inputValue);
      if (!normalized) {
        void setUrlQuery(null);
        return;
      }
      void setUrlQuery(normalized);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, urlQuery, setUrlQuery, isSearchPage]);
}

type SubmitSearchInput = {
  inputValue: string;
  setInputValue: (value: SetStateAction<string>) => void;
  isSearchPage: boolean;
  setUrlQuery: (value: string | null) => Promise<URLSearchParams>;
  send: (event: ComboboxEvent) => ComboboxIntent;
};

/**
 * Enter submits at once instead of waiting for the debounce. The combobox
 * decides: it closes the list and asks for a submit, unless the field is
 * blank.
 */
function useSubmitSearch({
  inputValue,
  setInputValue,
  isSearchPage,
  setUrlQuery,
  send,
}: SubmitSearchInput) {
  const router = useRouter();
  return useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const field = event.currentTarget.querySelector('input[name="q"]');
      const normalized = normalizeSearchQuery(
        field instanceof HTMLInputElement ? field.value : inputValue,
      );
      const intent = send({ type: 'enter-pressed', query: normalized });
      if (intent.kind !== 'submit-search') return;
      setInputValue(normalized);
      if (isSearchPage) {
        void setUrlQuery(normalized);
      } else {
        const href = searchHref(normalized);
        if (href) router.push(href);
      }
      if (field instanceof HTMLInputElement) field.blur();
    },
    [inputValue, isSearchPage, router, send, setInputValue, setUrlQuery],
  );
}

/**
 * Whether the field spins, from the query side (see `headerFieldLoading`)
 * plus any search request in flight. The key is matched by literal so the
 * key factory (which pulls Zod through contracts) stays out of the header
 * bundle.
 */
function useHeaderLoading({
  isSearchPage,
  inputValue,
  urlQuery,
}: {
  isSearchPage: boolean;
  inputValue: string;
  urlQuery: string | null;
}) {
  const debouncedQuery = useDebouncedQuery(inputValue);
  const fetching =
    useIsFetching({
      predicate: (query) => query.queryKey[0] === 'search',
    }) > 0;
  return headerFieldLoading({
    isSearchPage,
    inputValue,
    urlQuery,
    debouncedQuery,
    fetching,
  });
}

/**
 * Whether the field is expanded over the header bar on small screens. It
 * starts expanded on the search page, even after arriving there from
 * elsewhere. Opening it focuses the field.
 */
function useExpandedField(
  isSearchPage: boolean,
  inputRef: RefObject<HTMLInputElement | null>,
) {
  const [expanded, setExpanded] = useState(isSearchPage);

  useEffect(() => {
    if (isSearchPage) setExpanded(true);
  }, [isSearchPage]);

  // Rendered before focusing: the collapsed field is `display: none` on
  // small screens, and mobile browsers only open the keyboard when the
  // focus happens in the same tap.
  const expandAndFocus = useCallback(() => {
    flushSync(() => setExpanded(true));
    inputRef.current?.focus();
  }, [inputRef]);

  const collapse = useCallback(() => {
    setExpanded(false);
  }, []);

  return { expanded, expandAndFocus, collapse };
}

/**
 * The suggestions panel, while the list is open. Its own boundary: while the
 * panel's code loads, the outer one (the header's skeleton) would hide the
 * field and drop its focus.
 */
function SuggestionsSlot({
  combobox,
  query,
  anchor,
}: {
  combobox: SuggestionsCombobox;
  query: string;
  anchor: RefObject<Element | null>;
}) {
  if (!combobox.open) return null;
  return (
    <Suspense fallback={null}>
      <HeaderSuggestions
        query={query}
        anchor={anchor}
        highlighted={combobox.highlighted}
        onRowsChange={combobox.onRowsChange}
        onPickTrack={combobox.onPickTrack}
        onPickSearch={combobox.onPickSearch}
      />
    </Suspense>
  );
}

/**
 * The header search. A pill field from `md` up; below that, a button that
 * expands the field over the whole header bar. `⌘K`/`Ctrl K` focuses it.
 * Focusing, typing or blurring the field never navigates: outside the search
 * page only Enter goes to the search page with the normalized query. On the
 * search page the URL (and the fetch) follows typing in place, debounced,
 * and leaving the page clears the field since other pages have no `q`. On
 * the search page the field starts expanded on small screens, since it is
 * the only field left.
 *
 * Outside the search page the field also suggests Recordings while it has
 * text: the combobox state decides when the list is open, and the arrow keys
 * move a highlight through its rows. Enter opens the highlighted row or, with
 * none highlighted, submits the search; Escape closes the list first and
 * collapses the field on the second press. The list is never shown on the
 * search page.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const isSearchPage = pathname === '/search';
  const [urlQuery, setUrlQuery] = useQueryState('q');
  const [inputValue, setInputValue] = useSyncedInputValue(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLElement>(null);
  const { expanded, expandAndFocus, collapse } = useExpandedField(
    isSearchPage,
    inputRef,
  );
  const combobox = useSuggestionsCombobox({
    inputValue,
    setInputValue,
    inputRef,
    enabled: !isSearchPage,
    collapse,
  });

  useSearchHotkey(expandAndFocus);

  useLiveSearchNavigation({ inputValue, urlQuery, setUrlQuery, isSearchPage });

  const loading = useHeaderLoading({ isSearchPage, inputValue, urlQuery });
  const onSubmit = useSubmitSearch({
    inputValue,
    setInputValue,
    isSearchPage,
    setUrlQuery,
    send: combobox.send,
  });

  return (
    <>
      <HeaderSearchBar
        expanded={expanded}
        inputRef={inputRef}
        searchRef={searchRef}
        inputValue={inputValue}
        onInputChange={combobox.onInputChange}
        onSubmit={onSubmit}
        onKeyDown={combobox.onKeyDown}
        suggestionsOpen={combobox.open}
        activeRowId={combobox.activeRowId}
        onOpen={expandAndFocus}
        onCancel={combobox.onCancel}
        onFocus={combobox.onFocus}
        onBlur={combobox.onBlur}
        loading={loading}
      />
      <SuggestionsSlot
        combobox={combobox}
        query={inputValue}
        anchor={searchRef}
      />
    </>
  );
}
