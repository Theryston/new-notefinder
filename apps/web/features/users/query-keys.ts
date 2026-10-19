/** The cache key of a Profile's practice history; the cursor travels as the page param. */
export const practiceHistoryKey = (username: string) =>
  ['users', username, 'practice-history'] as const;
