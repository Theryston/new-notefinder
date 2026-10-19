/** Runs per page: the first one is prefetched on the server, the rest on demand. */
export const PRACTICE_HISTORY_PAGE_SIZE = 20;

/** The cache key of a Profile's history; the cursor travels as the page param. */
export const practiceHistoryKey = (username: string) =>
  ['users', username, 'practice-history'] as const;
