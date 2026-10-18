import type { SearchResultItem } from '@notefinder/contracts';

/** What the suggestions panel lists above its trailing "Search for" row. */
export type SuggestionPanelContent = {
  items: SearchResultItem[];
  /** A settled answer with no matches: the panel says so. */
  noSongs: boolean;
};

/**
 * The rows of the header suggestions. Before the first answer there is
 * nothing to list and no verdict to give, so "no songs" waits for a settled
 * empty response (the empty list a panel shows while it loads is not one).
 */
export function suggestionPanelContent(
  results: SearchResultItem[] | undefined,
): SuggestionPanelContent {
  return {
    items: results ?? [],
    noSongs: results !== undefined && results.length === 0,
  };
}
