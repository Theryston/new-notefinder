import type { CatalogDataset } from '@notefinder/contracts';

/**
 * Where the dump archives of a dataset live under the dump base URL
 * (`MUSICBRAINZ_DUMP_BASE_URL`, the `.../data` directory of
 * `data.metabrainz.org`). The sample is one `tar.xz` next to the full
 * export's two `tar.bz2` (core plus derived, no edit history), so both
 * datasets restore through the same `mbslave import <urls>` code path.
 */
const ARCHIVES: Record<CatalogDataset, readonly string[]> = {
  sample: ['mbdump-sample.tar.xz'],
  full: ['mbdump.tar.bz2', 'mbdump-derived.tar.bz2'],
};

const withoutTrailingSlash = (url: string): string =>
  url.endsWith('/') ? url.slice(0, -1) : url;

export const dumpDirectory = (
  baseUrl: string,
  dataset: CatalogDataset,
): string =>
  `${withoutTrailingSlash(baseUrl)}/${dataset === 'sample' ? 'sample' : 'fullexport'}`;

export const latestUrl = (baseUrl: string, dataset: CatalogDataset): string =>
  `${dumpDirectory(baseUrl, dataset)}/LATEST`;

/** The archives of one dump run (`latest` is its `LATEST` file, trimmed). */
export const resolveDumpUrls = (
  baseUrl: string,
  dataset: CatalogDataset,
  latest: string,
): string[] => {
  const directory = `${dumpDirectory(baseUrl, dataset)}/${latest.trim()}`;
  return ARCHIVES[dataset].map((archive) => `${directory}/${archive}`);
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
 * Reads the `LATEST` file of the dataset and resolves the archives of that
 * dump run. The archives themselves are downloaded by mbslave (`import`
 * streams them, resuming a partial download), so this only proves the base
 * URL answers before the restore starts.
 */
export type ResolveDumpUrls = (
  baseUrl: string,
  dataset: CatalogDataset,
) => Promise<string[]>;

export const resolveLatestDumpUrls = async (
  baseUrl: string,
  dataset: CatalogDataset,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> =>
  resolveDumpUrls(
    baseUrl,
    dataset,
    await readLatest(latestUrl(baseUrl, dataset), fetchImpl),
  );
