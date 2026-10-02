import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { LyricsDocument } from '../../lib/lyrics-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { LyricsService } from '../lyrics/lyrics.service.js';
import type { RecordingDocumentService } from '../recording/recording-document.service.js';
import type { IndexingRepository } from './indexing.repository.js';
import { IndexingService } from './indexing.service.js';

const recordingDoc = (id: number): RecordingDocument => ({
  mbid: `mbid-${id}`,
  title: `Title ${id}`,
  artistCredit: 'Artist',
  artistAliases: [],
  releaseTitles: [],
  workTitles: [],
  genres: [],
  disambiguation: '',
});

const setup = () => {
  const events: string[] = [];
  const bootstrap = {
    getStatus: vi.fn(async () => ({
      phase: 'restored' as const,
      dataset: 'sample' as const,
    })),
    startIndexing: vi.fn(async () => undefined),
    markReady: vi.fn(async () => undefined),
  };
  const documents = {
    findBatch: vi.fn(async (afterId: number, size: number) => {
      const ids = [1, 2, 3].filter((id) => id > afterId).slice(0, size);
      const last = ids.at(-1);
      return last === undefined
        ? undefined
        : { documents: ids.map(recordingDoc), lastRecordingId: last };
    }),
    countAll: vi.fn(async () => 3),
  };
  const repository = {
    getCheckpoint: vi.fn(async () => 0),
    saveCheckpoint: vi.fn(async () => undefined),
  };
  const index = {
    ensure: vi.fn(async () => undefined),
    upsert: vi.fn(async () => undefined),
  };
  const lyricsDocuments = {
    findDocuments: vi.fn(
      async (afterId: number): Promise<LyricsDocument[]> =>
        afterId === 0 ? [{ mbid: 'mbid-1', lyrics: 'words' }] : [],
    ),
  };
  const lyricsIndex = {
    ensure: vi.fn(async () => {
      events.push('lyrics ensure');
    }),
    upsert: vi.fn(async (batch: LyricsDocument[]) => {
      events.push(`lyrics upsert ${batch.map((doc) => doc.mbid).join(',')}`);
    }),
  };
  const service = new IndexingService({
    bootstrap: bootstrap as unknown as BootstrapService,
    documents: documents as unknown as RecordingDocumentService,
    repository: repository as unknown as IndexingRepository,
    index: index as unknown as MeilisearchIndex<RecordingDocument>,
    batchSize: 2,
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    lyrics: {
      documents: lyricsDocuments as unknown as LyricsService,
      index: lyricsIndex as unknown as MeilisearchIndex<LyricsDocument>,
    },
  });
  return { service, lyricsDocuments, lyricsIndex, events };
};

const signal = () => new AbortController().signal;

describe('IndexingService with Lyrics', () => {
  it("sends each batch's kept Lyrics after ensuring the lyrics index", async () => {
    const { service, lyricsDocuments, lyricsIndex, events } = setup();

    await service.run(signal());

    expect(lyricsIndex.ensure).toHaveBeenCalledOnce();
    expect(lyricsDocuments.findDocuments).toHaveBeenCalledWith(0, 2);
    expect(lyricsDocuments.findDocuments).toHaveBeenCalledWith(2, 2);
    expect(lyricsIndex.upsert).toHaveBeenCalledOnce();
    expect(events).toEqual(['lyrics ensure', 'lyrics upsert mbid-1']);
  });
});
