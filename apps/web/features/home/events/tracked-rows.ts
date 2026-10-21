/** A home row as the tracker knows it: its id and its items in order. */
export type TrackedHomeRow = {
  id: string;
  items: { id: string }[];
};

/** A feed page as the tracker knows it: the version its rows were read from. */
export type TrackedHomePage = {
  version: string;
  algorithmVersion: number;
  rows: TrackedHomeRow[];
};

/** What an event of a row carries: the feed version it was read from. */
export type HomeRowMeta = {
  feedVersion: string;
  algorithmVersion: number;
};

/** The rows of every page by id, with the feed version each was read from. */
export function rowMetaOf(pages: TrackedHomePage[]): Map<string, HomeRowMeta> {
  const meta = new Map<string, HomeRowMeta>();
  for (const page of pages) {
    for (const row of page.rows) {
      meta.set(row.id, {
        feedVersion: page.version,
        algorithmVersion: page.algorithmVersion,
      });
    }
  }
  return meta;
}
