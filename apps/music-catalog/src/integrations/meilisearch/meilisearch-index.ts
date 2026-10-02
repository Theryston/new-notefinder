import { isDeepStrictEqual } from 'node:util';
import {
  type EnqueuedTaskPromise,
  Meilisearch,
  MeilisearchApiError,
} from 'meilisearch';

/** The settings the service manages; every other one stays at its default. */
export type IndexSettings = {
  /** In ranking order: a match in an earlier attribute ranks higher. */
  searchableAttributes: string[];
  pagination: { maxTotalHits: number };
};

export type MeilisearchIndexConfig = {
  url: string;
  /** A search-only key for the server, a key that can write for the worker. */
  apiKey: string;
  uid: string;
  primaryKey: string;
};

/** The part of the SDK's client this class uses, so tests can stand in. */
export type MeilisearchClient = Pick<
  Meilisearch,
  'getRawIndex' | 'createIndex' | 'index' | 'swapIndexes' | 'deleteIndex'
>;

// A batch of a few thousand documents is indexed in seconds; a Meilisearch
// busy with a bigger queue needs minutes. The wait ends as soon as the task
// does, so the limit only bounds a task that never finishes.
const TASK_TIMEOUT_MS = 10 * 60_000;
const TASK_POLL_INTERVAL_MS = 100;

const isIndexNotFound = (error: unknown): boolean =>
  error instanceof MeilisearchApiError &&
  error.cause?.code === 'index_not_found';

const isDocumentNotFound = (error: unknown): boolean =>
  error instanceof MeilisearchApiError &&
  error.cause?.code === 'document_not_found';

/**
 * One Meilisearch index, behind the few operations the service needs. It is
 * the only place that knows the SDK: features depend on this class, so the
 * engine could be replaced without touching them. Every write waits for its
 * task, so when a method returns, its effect is searchable (or it threw).
 */
export class MeilisearchIndex<TDocument extends Record<string, unknown>> {
  constructor(
    private readonly client: MeilisearchClient,
    private readonly uid: string,
    private readonly primaryKey: string,
  ) {}

  /**
   * Creates the index, with its primary key, when it does not exist, and
   * applies `settings` when the index does not have them yet. Safe to call
   * on every start: an index that is up to date is left alone, so a restart
   * never makes Meilisearch reindex what is already there.
   */
  async ensure(settings: IndexSettings): Promise<void> {
    await this.createIfMissing();
    const index = this.client.index<TDocument>(this.uid);
    const current = await index.getSettings();
    const upToDate =
      isDeepStrictEqual(
        current.searchableAttributes,
        settings.searchableAttributes,
      ) &&
      current.pagination?.maxTotalHits === settings.pagination.maxTotalHits;
    if (!upToDate) {
      await this.wait(index.updateSettings(settings));
    }
  }

  /** Adds the documents, replacing the ones that share a primary key. */
  async upsert(documents: TDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }
    await this.wait(
      this.client.index<TDocument>(this.uid).addDocuments(documents),
    );
  }

  /** Removes the documents with these primary keys, when they are there. */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.wait(
      this.client.index<TDocument>(this.uid).deleteDocuments(ids),
    );
  }

  /**
   * Atomically swaps this index with another one: afterwards this uid holds
   * the other's documents and vice versa. The blue-green reimport builds the
   * new copy under `*_next` uids and swaps them into place, so clients flip
   * from the old copy to the new one between two requests, never mid-page.
   */
  async swapWith(otherUid: string): Promise<void> {
    await this.wait(
      this.client.swapIndexes([
        { indexes: [this.uid, otherUid], rename: false },
      ]),
    );
  }

  /**
   * Swaps every pair in one `swap-indexes` task: Meilisearch applies the
   * whole list atomically, so the blue-green reimport flips the recordings
   * and the lyrics indexes together, never one without the other. Two
   * separate `swapWith` calls leave a half-swapped catalog when the process
   * dies between them; this call has no between.
   */
  async swapPairs(
    pairs: Array<{ servingUid: string; nextUid: string }>,
  ): Promise<void> {
    if (pairs.length === 0) {
      return;
    }
    await this.wait(
      this.client.swapIndexes(
        pairs.map((pair) => ({
          indexes: [pair.servingUid, pair.nextUid] as [string, string],
          rename: false,
        })),
      ),
    );
  }

  /**
   * Whether the index holds a document with this primary key. The reimport
   * asks it about the parallel copy's documents before swapping: when a
   * restarted flip finds them already here, the swap ran and only the flip
   * record and the cleanup are left, so replaying the swap (which would swap
   * back) is skipped.
   */
  async hasDocument(id: string): Promise<boolean> {
    try {
      await this.client.index(this.uid).getDocument(id);
      return true;
    } catch (error) {
      if (isIndexNotFound(error) || isDocumentNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Deletes the whole index. The reimport drops the old copy this way. A
   * missing index is already gone (a rerun after the delete), so it resolves
   * instead of failing the flip.
   */
  async deleteIndex(): Promise<void> {
    try {
      await this.wait(this.client.deleteIndex(this.uid));
    } catch (error) {
      if (!isIndexNotFound(error)) {
        throw error;
      }
    }
  }

  /**
   * The primary keys of the best matches for `query`, in the order
   * Meilisearch ranked them. Nothing else is asked for: the caller loads
   * what it shows from its own database.
   */
  async search(
    query: string,
    page: { limit: number; offset: number },
  ): Promise<string[]> {
    const { hits } = await this.client
      .index<TDocument>(this.uid)
      .search(query, {
        limit: page.limit,
        offset: page.offset,
        attributesToRetrieve: [this.primaryKey],
      });
    return hits.map((hit) => {
      const id: unknown = hit[this.primaryKey];
      if (typeof id !== 'string') {
        throw new Error(
          `Meilisearch returned a hit without its ${this.primaryKey}`,
        );
      }
      return id;
    });
  }

  private async createIfMissing(): Promise<void> {
    try {
      await this.client.getRawIndex(this.uid);
    } catch (error) {
      if (!isIndexNotFound(error)) {
        throw error;
      }
      await this.wait(
        this.client.createIndex(this.uid, { primaryKey: this.primaryKey }),
      );
    }
  }

  private async wait(enqueued: EnqueuedTaskPromise): Promise<void> {
    const task = await enqueued.waitTask({
      timeout: TASK_TIMEOUT_MS,
      interval: TASK_POLL_INTERVAL_MS,
    });
    if (task.status !== 'succeeded') {
      throw new Error(
        `Meilisearch task ${task.uid} (${task.type}) ${task.status}: ${task.error?.message ?? 'no details'}`,
      );
    }
  }
}

export const createMeilisearchIndex = <
  TDocument extends Record<string, unknown>,
>(
  config: MeilisearchIndexConfig,
): MeilisearchIndex<TDocument> =>
  new MeilisearchIndex<TDocument>(
    new Meilisearch({ host: config.url, apiKey: config.apiKey }),
    config.uid,
    config.primaryKey,
  );
