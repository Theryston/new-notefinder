'use client';

import { useIsFetching } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import type { FocusEvent, FormEvent, SetStateAction } from 'react';
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
  pushSearch: (query: string) => void;
};

/**
 * Debounced live search: on the search page the URL (and the fetch) follows
 * typing in place; elsewhere typing navigates to the search page in real
 * time. A blank never navigates away.
 */
function useLiveSearchNavigation({
  inputValue,
  urlQuery,
  setUrlQuery,
  isSearchPage,
  pushSearch,
}: LiveSearchInput) {
  useEffect(() => {
    if (normalizeSearchQuery(inputValue) === normalizeSearchQuery(urlQuery)) {
      return;
    }
    const timer = setTimeout(() => {
      const normalized = normalizeSearchQuery(inputValue);
      if (!normalized) {
        if (isSearchPage) void setUrlQuery(null);
        return;
      }
      if (isSearchPage) {
        void setUrlQuery(normalized);
      } else {
        pushSearch(normalized);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, urlQuery, setUrlQuery, isSearchPage, pushSearch]);
}

type FallbackInput = {
  inputValue: string;
  pathname: string;
  isSearchPage: boolean;
  setExpanded: (expanded: boolean) => void;
};

/** idle: no fall; falling: pushed through the header; abandoned: cancelled before it landed. */
type FallState = 'idle' | 'falling' | 'abandoned';

/**
 * Focus outside the search page falls into it at once (keeping what was
 * typed, if anything); blurring or cancelling an empty field then goes back
 * to the page the fall came from, even when the cancel comes before the fall
 * lands (the page is left again as soon as it does). Pushes through the
 * header arm the way back.
 */
function useFocusFallAndEmptyBack({
  inputValue,
  pathname,
  isSearchPage,
  setExpanded,
}: FallbackInput) {
  const router = useRouter();
  const fallRef = useRef<FallState>('idle');

  // Any page but the search page drops a stale (superseded) fall.
  useEffect(() => {
    if (pathname !== '/search') fallRef.current = 'idle';
  }, [pathname]);

  // Landing on the search page: an abandoned fall is left again, anything
  // else expands the field.
  useEffect(() => {
    if (!isSearchPage) return;
    if (fallRef.current === 'abandoned') {
      fallRef.current = 'idle';
      router.back();
      return;
    }
    setExpanded(true);
  }, [isSearchPage, router, setExpanded]);

  const pushSearch = useCallback(
    (query: string) => {
      const href = searchHref(query);
      if (!href) return;
      fallRef.current = 'falling';
      router.push(href);
    },
    [router],
  );

  const onFieldFocus = useCallback(() => {
    if (isSearchPage) return;
    fallRef.current = 'falling';
    router.push(searchHref(inputValue) ?? '/search');
  }, [inputValue, isSearchPage, router]);

  const onFieldBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (!isSearchPage || fallRef.current !== 'falling') return;
      if (normalizeSearchQuery(event.currentTarget.value)) return;
      fallRef.current = 'idle';
      router.back();
    },
    [isSearchPage, router],
  );

  // Blur alone can't undo a fall that had not landed yet (or landed between
  // the button's pointerdown and click), so the cancel does it too.
  const cancel = useCallback(() => {
    if (fallRef.current !== 'falling' || normalizeSearchQuery(inputValue)) {
      return;
    }
    if (isSearchPage) {
      fallRef.current = 'idle';
      router.back();
    } else {
      fallRef.current = 'abandoned';
    }
  }, [inputValue, isSearchPage, router]);

  return { pushSearch, onFieldFocus, onFieldBlur, cancel };
}

type SubmitSearchInput = {
  inputValue: string;
  setInputValue: (value: SetStateAction<string>) => void;
  isSearchPage: boolean;
  setUrlQuery: (value: string | null) => Promise<URLSearchParams>;
  pushSearch: (query: string) => void;
};

/** Enter submits at once instead of waiting for the debounce. */
function useSubmitSearch({
  inputValue,
  setInputValue,
  isSearchPage,
  setUrlQuery,
  pushSearch,
}: SubmitSearchInput) {
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
        pushSearch(normalized);
      }
      if (field instanceof HTMLInputElement) field.blur();
    },
    [inputValue, isSearchPage, pushSearch, setInputValue, setUrlQuery],
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
 * Focusing the field outside the search page falls into it at once (keeping
 * what was typed, if anything); once there the URL (and the fetch) follows
 * typing in place, debounced. Blurring an empty field goes back to the page
 * the fall came from, and so does cancelling it (even before the fall has
 * landed). On the search page the field starts expanded on small
 * screens, since it is the only field left.
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const isSearchPage = pathname === '/search';
  const [urlQuery, setUrlQuery] = useQueryState('q');
  const [inputValue, setInputValue] = useSyncedInputValue(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(isSearchPage);

  // Rendered before focusing: the collapsed field is `display: none` on
  // small screens, and mobile browsers only open the keyboard when the
  // focus happens in the same tap.
  const expandAndFocus = useCallback(() => {
    flushSync(() => setExpanded(true));
    inputRef.current?.focus();
  }, []);

  useSearchHotkey(expandAndFocus);

  const { pushSearch, onFieldFocus, onFieldBlur, cancel } =
    useFocusFallAndEmptyBack({
      inputValue,
      pathname,
      isSearchPage,
      setExpanded,
    });

  useLiveSearchNavigation({
    inputValue,
    urlQuery,
    setUrlQuery,
    isSearchPage,
    pushSearch,
  });

  const collapse = useCallback(() => {
    cancel();
    setExpanded(false);
  }, [cancel]);
  const loading = useHeaderLoading(inputValue, urlQuery);
  const onSubmit = useSubmitSearch({
    inputValue,
    setInputValue,
    isSearchPage,
    setUrlQuery,
    pushSearch,
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
      onFieldFocus={onFieldFocus}
      onFieldBlur={onFieldBlur}
      loading={loading}
    />
  );
}
