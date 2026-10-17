'use client';

import dynamic from 'next/dynamic';
import type { FocusEvent, FormEvent, RefObject } from 'react';

import { HeaderSearchBar } from './header-search-bar';

const HeaderSearchSuggestions = dynamic(
  () =>
    import('./header-search-suggestions').then(
      (module) => module.HeaderSearchSuggestions,
    ),
  { ssr: false },
);

export type HeaderSearchViewModel = {
  expanded: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  searchRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  inputValue: string;
  listOpen: boolean;
  loading: boolean;
  /** The on-demand chunk stays mounted once opened (exit motion, cache). */
  suggestionsMounted: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  expandAndFocus: () => void;
  collapse: () => void;
  interactions: {
    onInputChange: (value: string) => void;
    onFieldFocus: () => void;
    onFieldBlur: (event: FocusEvent<HTMLInputElement>) => void;
    onDismiss: () => void;
    onNavigate: () => void;
  };
};

/**
 * The bar plus the suggestions list hanging under it. The list (and the
 * suggestions query with the contracts runtime) loads on demand the first
 * time it opens, so first-load JS stays lean; closing only hides it.
 */
export function HeaderSearchView({ view }: { view: HeaderSearchViewModel }) {
  return (
    <>
      <HeaderSearchBar
        expanded={view.expanded}
        inputRef={view.inputRef}
        searchRef={view.searchRef}
        inputValue={view.inputValue}
        onInputChange={view.interactions.onInputChange}
        onSubmit={view.onSubmit}
        onEscape={view.collapse}
        onOpen={view.expandAndFocus}
        onCancel={view.collapse}
        onFieldFocus={view.interactions.onFieldFocus}
        onFieldBlur={view.interactions.onFieldBlur}
        listOpen={view.listOpen}
        loading={view.loading}
      />
      {view.suggestionsMounted ? (
        <HeaderSearchSuggestions
          anchor={() => view.searchRef.current}
          contentRef={view.contentRef}
          open={view.listOpen}
          query={view.listOpen ? view.inputValue : ''}
          onDismiss={view.interactions.onDismiss}
          onNavigate={view.interactions.onNavigate}
        />
      ) : null}
    </>
  );
}
