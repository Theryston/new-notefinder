import { MeilisearchApiError } from 'meilisearch';
import {
  type MeilisearchClient,
  MeilisearchIndex,
} from './meilisearch-index.js';

const apiError = (status: number, code: string) =>
  new MeilisearchApiError(new Response(null, { status }), {
    message: code,
    code,
    type: 'invalid_request',
    link: '',
  });

// What the SDK returns for a write: a promise of the enqueued task that also
// knows how to wait for it (mirrors the fake in meilisearch-index.spec.ts).
const enqueued = () =>
  Object.assign(Promise.resolve({ taskUid: 7 }), {
    waitTask: vi.fn(async () => ({
      uid: 7,
      type: 'indexSwap',
      status: 'succeeded',
      error: null,
    })),
  });

const setup = (indexOverrides: Record<string, unknown> = {}) => {
  const index = {
    getDocument: vi.fn(async () => ({ mbid: 'some-mbid' })),
    ...indexOverrides,
  };
  const client = {
    swapIndexes: vi.fn(() => enqueued()),
    deleteIndex: vi.fn(() => enqueued()),
    index: vi.fn(() => index),
  };
  const meili = new MeilisearchIndex<{ mbid: string }>(
    client as unknown as MeilisearchClient,
    'recordings',
    'mbid',
  );
  return { meili, client, index };
};

describe('MeilisearchIndex paired swap and probes', () => {
  it('swaps every pair in one swap-indexes task', async () => {
    const { meili, client } = setup();

    await meili.swapPairs([
      { servingUid: 'recordings', nextUid: 'recordings_next' },
      { servingUid: 'lyrics', nextUid: 'lyrics_next' },
    ]);

    expect(client.swapIndexes).toHaveBeenCalledTimes(1);
    expect(client.swapIndexes).toHaveBeenCalledWith([
      { indexes: ['recordings', 'recordings_next'], rename: false },
      { indexes: ['lyrics', 'lyrics_next'], rename: false },
    ]);
  });

  it('skips the swap task without pairs', async () => {
    const { meili, client } = setup();

    await meili.swapPairs([]);

    expect(client.swapIndexes).not.toHaveBeenCalled();
  });

  it('finds a document it holds', async () => {
    const { meili, index } = setup();

    await expect(meili.hasDocument('some-mbid')).resolves.toBe(true);
    expect(index.getDocument).toHaveBeenCalledWith('some-mbid');
  });

  it('misses a document Meilisearch does not know', async () => {
    const { meili } = setup({
      getDocument: vi.fn(async () => {
        throw apiError(404, 'document_not_found');
      }),
    });

    await expect(meili.hasDocument('missing-mbid')).resolves.toBe(false);
  });

  it('misses a document of an index that is gone', async () => {
    const { meili } = setup({
      getDocument: vi.fn(async () => {
        throw apiError(404, 'index_not_found');
      }),
    });

    await expect(meili.hasDocument('missing-mbid')).resolves.toBe(false);
  });

  it('rethrows a probe that fails for another reason', async () => {
    const { meili } = setup({
      getDocument: vi.fn(async () => {
        throw apiError(500, 'internal');
      }),
    });

    await expect(meili.hasDocument('some-mbid')).rejects.toThrow('internal');
  });

  it('deletes the whole index', async () => {
    const { meili, client } = setup();

    await meili.deleteIndex();

    expect(client.deleteIndex).toHaveBeenCalledWith('recordings');
  });

  it('treats deleting a missing index as already done', async () => {
    const { meili, client } = setup();
    client.deleteIndex.mockImplementationOnce(() =>
      Object.assign(Promise.resolve({ taskUid: 9 }), {
        waitTask: vi.fn(async () => {
          throw apiError(404, 'index_not_found');
        }),
      }),
    );

    await expect(meili.deleteIndex()).resolves.toBeUndefined();
  });

  it('still fails deleting an index on another error', async () => {
    const { meili, client } = setup();
    client.deleteIndex.mockImplementationOnce(() =>
      Object.assign(Promise.resolve({ taskUid: 9 }), {
        waitTask: vi.fn(async () => {
          throw apiError(500, 'internal');
        }),
      }),
    );

    await expect(meili.deleteIndex()).rejects.toThrow('internal');
  });
});
