'use client';

import { useIsFetching } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import type { FormEvent, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { usePathname, useRouter } from '@/lib/i18n/navigation';

import { isSearchHotkey } from '../search-hotkey';
import { searchHref } from '../search-href';
import { normalizeSearchQuery, SEARCH_DEBOUNCE_MS } from '../search-params';
import { HeaderSearchBar } from './header-search-bar';

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
 * The header search. A pill field from `md` up; below that, a button that
 * expands the field over the whole header bar. `⌘K`/`Ctrl K` focuses it.
 * Focusing, typing or blurring the field never navigates: outside the search
 * page only Enter goes to the search page with the normalized query. On the
 * search page the URL (and the fetch) follows typing in place, debounced,
 * and leaving the page clears the field since other pages have no `q`. On
 * the search page the field starts expanded on small screens, since it is
 * the only field left.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const isSearchPage = pathname === '/search';
  const [urlQuery, setUrlQuery] = useQueryState('q');
  const [inputValue, setInputValue] = useSyncedInputValue(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
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
  }, []);

  useSearchHotkey(expandAndFocus);

  useLiveSearchNavigation({
    inputValue,
    urlQuery,
    setUrlQuery,
    isSearchPage,
  });

  const collapse = useCallback(() => {
    setExpanded(false);
  }, []);
  const loading = useHeaderLoading(inputValue, urlQuery);
  const onSubmit = useSubmitSearch({
    inputValue,
    setInputValue,
    isSearchPage,
    setUrlQuery,
  });

  return (
    <HeaderSearchBar
      expanded={expanded}
      inputRef={inputRef}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onSubmit={onSubmit}
      onEscape={collapse}
      onOpen={expandAndFocus}
      onCancel={collapse}
      loading={loading}
    />
  );
}
