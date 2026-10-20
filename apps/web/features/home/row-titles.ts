/**
 * The row titles this web can translate. The feed names a title by key, so a
 * key missing here (a row the web doesn't know yet) hides its row instead of
 * showing a raw key. Adding a row kind to the API means adding its key here
 * and to both locale files.
 */
export const HOME_ROW_TITLE_KEYS = [
  'home.rows.trendingToday',
  'home.rows.newTracks',
] as const;

export type HomeRowTitleKey = (typeof HOME_ROW_TITLE_KEYS)[number];

const KNOWN_TITLE_KEYS: ReadonlySet<string> = new Set(HOME_ROW_TITLE_KEYS);

export const isHomeRowTitleKey = (key: string): key is HomeRowTitleKey =>
  KNOWN_TITLE_KEYS.has(key);
