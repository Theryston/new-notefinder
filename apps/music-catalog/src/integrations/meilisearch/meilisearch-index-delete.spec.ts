import { MeilisearchIndex } from './meilisearch-index.js';

type Doc = { mbid: string; title: string };

// Removing documents waits the same way adding them does: when the method
// returns, the MBIDs are gone from the index (or it threw).
const enqueued = () =>
  Object.assign(Promise.resolve({ taskUid: 7 }), {
    waitTask: vi.fn(async () => ({
      uid: 7,
      type: 'documentDeletion',
      status: 'succeeded',
      error: null,
    })),
  });

const setup = () => {
  const index = {
    deleteDocuments: vi.fn(() => enqueued()),
  };
  const client = {
    getRawIndex: vi.fn(async () => ({})),
    createIndex: vi.fn(() => enqueued()),
    index: vi.fn(() => index),
  };
  const meili = new MeilisearchIndex<Doc>(
    client as never,
    'recordings',
    'mbid',
  );
  return { meili, index };
};

describe('MeilisearchIndex.deleteDocuments', () => {
  it('removes the documents and waits until they are gone', async () => {
    const { meili, index } = setup();

    await meili.deleteDocuments(['a', 'b']);

    expect(index.deleteDocuments).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
  });

  it('sends nothing for no MBIDs', async () => {
    const { meili, index } = setup();

    await meili.deleteDocuments([]);

    expect(index.deleteDocuments).not.toHaveBeenCalled();
  });
});
