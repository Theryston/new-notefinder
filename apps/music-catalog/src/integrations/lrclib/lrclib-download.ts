import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import { z } from 'zod';

// The dump listing is an undocumented JSON document with one object per dump;
// only the latest is kept online, and its key holds the file name.
const listingSchema = z.object({
  objects: z.array(
    z.object({ key: z.string(), uploaded: z.string().optional() }),
  ),
});

type FetchFn = typeof fetch;

/**
 * The key of the latest LRCLIB dump, from the listing endpoint. Keys embed
 * their timestamp (`...-YYYYMMDDTHHMMSSZ.sqlite3.gz`), so sorting them orders
 * the dumps; the listing holds no checksum, so the gzip CRC checked while
 * downloading is the integrity check.
 */
export const fetchLatestDumpKey = async (
  listingUrl: string,
  fetchFn: FetchFn = fetch,
): Promise<string> => {
  const response = await fetchFn(listingUrl);
  if (!response.ok) {
    throw new Error(
      `Reading the LRCLIB dump listing at ${listingUrl} failed with HTTP ${response.status}`,
    );
  }
  const listing = listingSchema.parse(await response.json());
  const keys = listing.objects.map((object) => object.key).sort();
  const latest = keys.at(-1);
  if (latest === undefined) {
    throw new Error(`The LRCLIB dump listing at ${listingUrl} holds no dumps`);
  }
  return latest;
};

export type LrclibDownloadOptions = {
  /** The directory the dump files live under; the key is appended to it. */
  baseUrl: string;
  key: string;
  /** Where the unpacked file lands; the OS temp dir when left out. */
  dir?: string;
  fetchFn?: FetchFn;
  /** Aborting it stops the download. */
  signal?: AbortSignal;
};

/**
 * Downloads the dump and gunzips it as a stream straight to its SQLite file:
 * the `.gz` is never kept (about 260 GB of temp disk in `full`, deleted after
 * the import), and `Range` resume is deliberately out (best effort upstream).
 */
export const downloadLrclibDump = async (
  options: LrclibDownloadOptions,
): Promise<{ key: string; path: string }> => {
  const { baseUrl, key, fetchFn = fetch, signal } = options;
  const url = `${baseUrl.replace(/\/+$/, '')}/${key}`;
  const response = await fetchFn(url, { signal });
  if (!response.ok || response.body === null) {
    throw new Error(
      `Downloading the LRCLIB dump ${key} failed with HTTP ${response.status}`,
    );
  }
  const path = join(
    options.dir ?? tmpdir(),
    `lrclib-dump-${Date.now()}.sqlite3`,
  );
  await pipeline(
    // The download comes as a DOM stream; node reads it as a web stream.
    Readable.fromWeb(response.body as unknown as WebReadableStream),
    createGunzip(),
    createWriteStream(path),
  );
  return { key, path };
};
