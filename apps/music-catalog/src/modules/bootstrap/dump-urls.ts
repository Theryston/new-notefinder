/**
 * Where the dump archives live under the dump base URL
 * (`MUSICBRAINZ_DUMP_BASE_URL`, the `.../data` directory of
 * `data.metabrainz.org`): the full export's two `tar.bz2` (core plus
 * derived, no edit history), restored with `mbslave import <urls>`. The
 * `tiny` dataset never reaches this module: it is seeded locally and
 * downloads nothing.
 */
const ARCHIVES = ['mbdump.tar.bz2', 'mbdump-derived.tar.bz2'] as const;

const withoutTrailingSlash = (url: string): string =>
  url.endsWith('/') ? url.slice(0, -1) : url;

const dumpDirectory = (baseUrl: string): string =>
  `${withoutTrailingSlash(baseUrl)}/fullexport`;

export const latestUrl = (baseUrl: string): string =>
  `${dumpDirectory(baseUrl)}/LATEST`;

/**
 * Reads the dump run (`LATEST` value) back from resolved archive URLs, so the
 * restore can log what it resolved without fetching `LATEST` twice. Returns
 * undefined when the URLs are empty or malformed.
 */
export const latestFromArchiveUrls = (
  urls: readonly string[],
): string | undefined => {
  const first = urls[0];
  if (first === undefined) {
    return undefined;
  }
  const segments = first.split('/');
  const latest = segments[segments.length - 2];
  if (latest === undefined || latest.length === 0) {
    return undefined;
  }
  return latest;
};

/** The archives of one dump run (`latest` is its `LATEST` file, trimmed). */
export const resolveDumpUrls = (baseUrl: string, latest: string): string[] => {
  const directory = `${dumpDirectory(baseUrl)}/${latest.trim()}`;
  return ARCHIVES.map((archive) => `${directory}/${archive}`);
};

const readLatest = async (
  url: string,
  fetchImpl: typeof fetch,
): Promise<string> => {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      `Could not read ${url}: HTTP ${response.status} (is MUSICBRAINZ_DUMP_BASE_URL pointing at a MusicBrainz data directory?)`,
    );
  }
  const latest = (await response.text()).trim();
  if (latest.length === 0) {
    throw new Error(`Could not read ${url}: the LATEST file is empty`);
  }
  return latest;
};

/**
 * Reads the `LATEST` file of the full export and resolves the archives of
 * that dump run. The archives themselves are downloaded by mbslave (`import`
 * streams them, resuming a partial download), so this only proves the base
 * URL answers before the restore starts.
 */
export type ResolveDumpUrls = (baseUrl: string) => Promise<string[]>;

export const resolveLatestDumpUrls = async (
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> =>
  resolveDumpUrls(baseUrl, await readLatest(latestUrl(baseUrl), fetchImpl));

const parseContentLength = (value: string | null): number | undefined => {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

const headArchiveSize = async (
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<number | undefined> => {
  try {
    const response = await fetchImpl(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return undefined;
    }
    return parseContentLength(response.headers.get('content-length'));
  } catch {
    return undefined;
  }
};

/**
 * Sums the `Content-Length` of the archives with one `HEAD` per URL, so the
 * restore can log the total bytes before mbslave downloads them. Best
 * effort: any missing or unparsable size omits the whole total (undefined)
 * instead of failing the restore. Never throws.
 */
export const fetchArchiveTotalBytes = async (
  urls: readonly string[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<number | undefined> => {
  if (urls.length === 0) {
    return undefined;
  }
  let total = 0;
  for (const url of urls) {
    const size = await headArchiveSize(url, fetchImpl, timeoutMs);
    if (size === undefined) {
      return undefined;
    }
    total += size;
  }
  return total;
};
