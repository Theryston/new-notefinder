import {
  type MeilisearchClient,
  MeilisearchIndex,
} from './meilisearch-index.js';

// What the SDK returns for a write: a promise of the enqueued task that also
// knows how to wait for it (mirrors the fake in meilisearch-index.spec.ts,
// extended with the swap and delete calls; that spec is left untouched).
const enqueued = () =>
  Object.assign(Promise.resolve({ taskUid: 7 }), {
    waitTask: vi.fn(async () => ({
      uid: 7,
      type: 'indexSwap',
      status: 'succeeded',
      error: null,
    })),
  });

const setup = () => {
  const client = {
    swapIndexes: vi.fn(() => enqueued()),
    deleteIndex: vi.fn(() => enqueued()),
  };
  const meili = new MeilisearchIndex<{ mbid: string }>(
    client as unknown as MeilisearchClient,
    'recordings',
    'mbid',
  );
  return { meili, client };
};

describe('MeilisearchIndex swap and delete', () => {
  it('swaps the index contents without renaming the uids', async () => {
    const { meili, client } = setup();

    await meili.swapWith('recordings_next');

    expect(client.swapIndexes).toHaveBeenCalledWith([
      { indexes: ['recordings', 'recordings_next'], rename: false },
    ]);
  });

  it('throws when the swap task fails', async () => {
    const { meili, client } = setup();
    client.swapIndexes.mockImplementationOnce(
      () =>
        Object.assign(Promise.resolve({ taskUid: 8 }), {
          waitTask: async () => ({
            uid: 8,
            type: 'indexSwap',
            status: 'failed',
            error: {
              message: 'index not found',
              code: '',
              type: '',
              link: '',
            },
          }),
        }) as never,
    );

    await expect(meili.swapWith('recordings_next')).rejects.toThrow(
      'indexSwap',
    );
  });

  it('deletes the whole index', async () => {
    const { meili, client } = setup();

    await meili.deleteIndex();

    expect(client.deleteIndex).toHaveBeenCalledWith('recordings');
  });
});
