'use client';

import { useIsFetching } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import type {
  Dispatch,
  FocusEvent,
  FormEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

import {
  type ComboboxEvent,
  initialComboboxState,
  updateCombobox,
} from '../combobox-state-machine';
import { isSearchHotkey } from '../search-hotkey';
import { searchHref } from '../search-href';
import {
  isSearchableQuery,
  normalizeSearchQuery,
  SEARCH_DEBOUNCE_MS,
} from '../search-params';
import { HeaderSearchView } from './header-search-view';

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
};

/** Enter submits at once instead of waiting for the debounce. */
function useSubmitSearch({
  inputValue,
  setInputValue,
  isSearchPage,
  setUrlQuery,
}: SubmitSearchInput) {
  const router = useRouter();
  return useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const field = event.currentTarget.querySelector('input[name="q"]');
      const normalized = normalizeSearchQuery(
        field instanceof HTMLInputElement ? field.value : inputValue,
      );
      if (!normalized) return;
      setInputValue(normalized);
      if (isSearchPage) {
        void setUrlQuery(normalized);
      } else {
        const href = searchHref(normalized);
        if (href) router.push(href);
      }
      if (field instanceof HTMLInputElement) field.blur();
    },
    [inputValue, isSearchPage, router, setInputValue, setUrlQuery],
  );
}

/**
 * Whether the field spins: from the first keystroke (debounce pending)
 * until the fetch it triggered settles. The key is matched by literal so
 * the key factory (which pulls Zod through contracts) stays out of the
 * header bundle.
 */
function useHeaderLoading(inputValue: string, urlQuery: string | null) {
  const searching =
    useIsFetching({
      predicate: (query) => query.queryKey[0] === 'search',
    }) > 0;
  return (
    normalizeSearchQuery(inputValue) !== normalizeSearchQuery(urlQuery) ||
    searching
  );
}

/**
 * The suggestions combobox: whether the list is open. The machine owns
 * open/close; a blank field and the search page (whose grid already shows
 * the matches) never show the list. The row count the arrow events wrap
 * over is wired by the keyboard change; until then the highlight stays
 * empty, so the count is unused.
 */
function useSuggestionsCombobox(inputValue: string, isSearchPage: boolean) {
  const [combobox, send] = useReducer(
    (
      state: typeof initialComboboxState,
      event: ComboboxEvent,
    ): typeof initialComboboxState => updateCombobox(state, event, 0).state,
    initialComboboxState,
  );

  const listOpen =
    combobox.open && !isSearchPage && isSearchableQuery(inputValue);
  return { listOpen, send };
}

/** Field and list events: typing, focus, blur, dismissal and navigation. */
function useListInteractions({
  setInputValue,
  inputRef,
  contentRef,
  send,
}: {
  setInputValue: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  send: Dispatch<ComboboxEvent>;
}) {
  const onInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      send({ type: 'input-changed', query: value });
    },
    [setInputValue, send],
  );

  const onFieldFocus = useCallback(() => {
    send({ type: 'focused', query: inputRef.current?.value ?? '' });
  }, [inputRef, send]);

  const onFieldBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      // A Tab onto a row keeps the list open; everywhere else the blur
      // closes it, without navigating.
      const target = event.relatedTarget;
      const movedToRow =
        target instanceof Element &&
        contentRef.current?.contains(target) &&
        target.closest('a,button') !== null;
      if (!movedToRow) {
        send({ type: 'blurred' });
      }
    },
    [contentRef, send],
  );

  const onDismiss = useCallback(() => {
    send({ type: 'blurred' });
  }, [send]);

  // A row navigated: release the field, like a submit does.
  const onNavigate = useCallback(() => {
    inputRef.current?.blur();
  }, [inputRef]);

  return { onInputChange, onFieldFocus, onFieldBlur, onDismiss, onNavigate };
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
 * Outside the search page, typing opens the suggestions list under the
 * field: up to 6 Recordings in catalog rank order plus a trailing Search-for
 * row. The list closes on blur or outside press without navigating, and
 * focusing a field that still has text reopens it with the cached
 * suggestions.
 */
/** The expanded field state: open on the search page, collapsible. */
function useExpandedField(
  inputRef: RefObject<HTMLInputElement | null>,
  isSearchPage: boolean,
) {
  const [expanded, setExpanded] = useState(isSearchPage);

  // The field starts expanded on the search page, even after arriving there
  // from elsewhere.
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

export function HeaderSearch() {
  const pathname = usePathname();
  const isSearchPage = pathname === '/search';
  const [urlQuery, setUrlQuery] = useQueryState('q');
  const [inputValue, setInputValue] = useSyncedInputValue(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { expanded, expandAndFocus, collapse } = useExpandedField(
    inputRef,
    isSearchPage,
  );
  const { listOpen, send } = useSuggestionsCombobox(inputValue, isSearchPage);
  const interactions = useListInteractions({
    setInputValue,
    inputRef,
    contentRef,
    send,
  });
  // Once opened, the suggestions chunk stays mounted: closing then only
  // hides the list, keeping its exit motion, and the cached query answers
  // the reopening without a second request.
  const [suggestionsMounted, setSuggestionsMounted] = useState(false);
  useEffect(() => {
    if (listOpen) setSuggestionsMounted(true);
  }, [listOpen]);

  useSearchHotkey(expandAndFocus);

  useLiveSearchNavigation({
    inputValue,
    urlQuery,
    setUrlQuery,
    isSearchPage,
  });

  const loading = useHeaderLoading(inputValue, urlQuery);
  const onSubmit = useSubmitSearch({
    inputValue,
    setInputValue,
    isSearchPage,
    setUrlQuery,
  });

  return (
    <HeaderSearchView
      view={{
        expanded,
        inputRef,
        searchRef,
        contentRef,
        inputValue,
        listOpen,
        loading,
        suggestionsMounted,
        onSubmit,
        expandAndFocus,
        collapse,
        interactions,
      }}
    />
  );
}
