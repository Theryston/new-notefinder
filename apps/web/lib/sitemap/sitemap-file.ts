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
