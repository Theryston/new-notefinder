'use client';

import type { SearchScope } from '@notefinder/contracts';
import { SearchIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';
import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  isSearchableQuery,
  normalizeSearchQuery,
  parseSearchScope,
  SEARCH_DEBOUNCE_MS,
} from '../search-params';
import { SearchPrompt } from './search-prompt';
import { SearchSkeleton } from './search-skeleton';

/**
 * The result grid (infinite query, response parsing, cover art) loads on
 * demand, so the search page stays inside the first-load JS budget: the
 * field and toggle paint instantly, results stream in right after.
 */
const SearchResults = dynamic(
  () => import('./search-results').then((module) => module.SearchResults),
  { loading: () => <SearchSkeleton /> },
);

const SCOPES: readonly SearchScope[] = ['metadata', 'lyrics'];

/** Lyrics lives only here: the header field never reads or writes it. */
function ScopeToggle({
  scope,
  onChange,
}: {
  scope: SearchScope;
  onChange: (scope: SearchScope) => void;
}) {
  const t = useTranslations('search.scope');

  return (
    <fieldset className="inline-flex items-center gap-0.5 self-start rounded-full bg-muted p-0.75">
      <legend className="sr-only">{t('label')}</legend>
      {SCOPES.map((option) => {
        const pressed = option === scope;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option)}
            className={cn(
              'h-7.5 rounded-full px-2.5 font-semibold text-[0.8125rem] outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50',
              pressed
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(option)}
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * The live search: the field mirrors `q` in the URL (debounced in place,
 * so typing never loses focus), the toggle mirrors `scope` (metadata by
 * default, omitted from the URL), and results follow both.
 */
export function SearchView() {
  const t = useTranslations('search');
  const [urlQuery, setUrlQuery] = useQueryState('q');
  const [urlScope, setUrlScope] = useQueryState('scope');
  const query = normalizeSearchQuery(urlQuery);
  const scope = parseSearchScope(urlScope);
  const [inputValue, setInputValue] = useState(urlQuery ?? '');

  // The URL can change under the field (back/forward, header submit while
  // here): adopt it, unless it only differs in blanks the user is typing.
  useEffect(() => {
    setInputValue((current) => {
      const next = urlQuery ?? '';
      return normalizeSearchQuery(current) === normalizeSearchQuery(next)
        ? current
        : next;
    });
  }, [urlQuery]);

  // Debounced URL update: the fetch (keyed by the URL) follows typing.
  useEffect(() => {
    if (normalizeSearchQuery(inputValue) === query) return;
    const timer = setTimeout(() => {
      const normalized = normalizeSearchQuery(inputValue);
      void setUrlQuery(normalized || null);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, query, setUrlQuery]);

  const setScope = (next: SearchScope) => {
    void setUrlScope(next === 'metadata' ? null : next);
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        value={inputValue}
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t('field.label')}
        placeholder={t('field.placeholder')}
        onChange={(event) => setInputValue(event.target.value)}
        start={<SearchIcon aria-hidden="true" className="size-5" />}
        className="md:max-w-105"
      />
      <ScopeToggle scope={scope} onChange={setScope} />
      {isSearchableQuery(query) ? (
        <SearchResults query={query} scope={scope} />
      ) : (
        <SearchPrompt />
      )}
    </div>
  );
}
