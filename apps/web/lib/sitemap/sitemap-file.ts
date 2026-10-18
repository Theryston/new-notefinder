import type { CursorPage } from '@notefinder/contracts';

/**
 * The items of the `index`th sitemap file, or undefined past the last one.
 * A file is one page of an entity listing, so reaching a later file walks
 * the cursors of the earlier pages. Those pages are cached one by one, so
 * the walk costs one read per file, not one per request.
 */
export async function sitemapFileItems<TItem>(
  readPage: (cursor: string | undefined) => Promise<CursorPage<TItem>>,
  index: number,
): Promise<TItem[] | undefined> {
  let cursor: string | undefined;
  for (let page = 0; page < index; page++) {
    const { nextCursor } = await readPage(cursor);
    if (nextCursor === null) return undefined;
    cursor = nextCursor;
  }
  return (await readPage(cursor)).items;
}

/**
 * How many numeric files a listing has: one per API page, so the count is the
 * number of pages, found by walking the cursors (each page is cached, so the
 * walk is cheap after the first index request). An upstream failure is logged
 * and counts the pages read so far. The count is never below one: file 0
 * always answers, empty and partial if its own read fails.
 */
export async function countSitemapFiles<TItem>(
  name: string,
  readPage: (cursor: string | undefined) => Promise<CursorPage<TItem>>,
): Promise<number> {
  let files = 0;
  let cursor: string | undefined;
  let more = true;
  try {
    while (more) {
      const page = await readPage(cursor);
      files++;
      more = page.nextCursor !== null;
      cursor = page.nextCursor ?? undefined;
    }
  } catch (error) {
    console.error(
      `Sitemap ${name} could not be counted, listing the ${files} file(s) read so far: ${messageOf(error)}`,
    );
  }
  return Math.max(files, 1);
}

/** A sitemap file as a route answers it. `partial` marks a failed read. */
export type SitemapFile<TItem> = {
  items: readonly TItem[];
  partial: boolean;
};

/**
 * Reads one sitemap file for a route. `read` answers its items, or undefined
 * past the last file (a not-found). An upstream failure is logged and answered
 * as an empty file marked partial: crawlers still get valid XML, the failure
 * stays in the server log, and the CDN keeps the thin file only briefly. A
 * bare 500 would make the crawler drop the file, and a silent empty one would
 * hide the outage.
 */
export async function readSitemapFile<TItem>(
  name: string,
  read: () => Promise<readonly TItem[] | undefined>,
): Promise<SitemapFile<TItem> | undefined> {
  try {
    const items = await read();
    return items === undefined ? undefined : { items, partial: false };
  } catch (error) {
    console.error(
      `Sitemap ${name} could not be read, answering it empty: ${messageOf(error)}`,
    );
    return { items: [], partial: true };
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
