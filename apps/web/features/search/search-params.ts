import type { SearchScope } from '@notefinder/contracts';

/** A blank query never hits the API (fast feedback, no spam). */
export const SEARCH_MIN_QUERY_LENGTH = 1;

/** How long typing waits before the URL (and the fetch) updates. */
export const SEARCH_DEBOUNCE_MS = 230;

/**
 * What the user typed, without leading/trailing blanks and with runs of
 * whitespace collapsed, so `q` in the URL and the API query stay canonical.
 */
export function normalizeSearchQuery(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/** Whether the query is worth a request (at least 1 non-blank character). */
export function isSearchableQuery(value: string): boolean {
  return normalizeSearchQuery(value).length >= SEARCH_MIN_QUERY_LENGTH;
}

/**
 * The `scope` URL value as the API reads it. Anything missing or unknown
 * falls back to `metadata`, so header links (`?q=…` with no scope) stay
 * precise and shareable links never break.
 *
 * Guarded by hand on purpose: this module is also read by the site header,
 * and a runtime contracts import would pull Zod into the shared bundle.
 * The vocabulary is pinned by the tests below.
 */
export function parseSearchScope(value: unknown): SearchScope {
  return value === 'metadata' || value === 'lyrics' ? value : 'metadata';
}
