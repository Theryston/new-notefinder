import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { LyricsDocument } from '../../lib/lyrics-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { RecordingSummaryService } from '../recording/recording-summary.service.js';
import { SearchService } from './search.service.js';

const summary = (mbid: string) => ({
  mbid,
  title: `Title of ${mbid}`,
  lengthMs: null,
  disambiguation: '',
  video: false,
  artistCredit: { name: 'Artist', artists: [] },
  primaryRelease: null,
  genres: [],
});

const params = {
  query: 'drifting on',
  scope: 'lyrics',
  limit: 10,
  offset: 3,
} as const;

const setup = (hits: string[]) => {
  const bootstrap = { assertReady: vi.fn(async () => undefined) };
  const index = { search: vi.fn(async () => ['metadata-hit']) };
  const lyricsIndex = { search: vi.fn(async () => hits) };
  const summaries = {
    findByMbids: vi.fn(async (mbids: string[]) => mbids.map(summary)),
  };
  const service = new SearchService({
    bootstrap: bootstrap as unknown as BootstrapService,
    index: index as unknown as MeilisearchIndex<RecordingDocument>,
    summaries: summaries as unknown as RecordingSummaryService,
    lyricsIndex: lyricsIndex as unknown as MeilisearchIndex<LyricsDocument>,
  });
  return { service, index, lyricsIndex, summaries };
};

describe('SearchService in the lyrics scope, with Lyrics imported', () => {
  it('asks the lyrics index for the page, never the metadata one', async () => {
    const { service, index, lyricsIndex, summaries } = setup(['x', 'y']);

    await service.search(params);

    expect(lyricsIndex.search).toHaveBeenCalledExactlyOnceWith('drifting on', {
      limit: 10,
      offset: 3,
    });
    expect(index.search).not.toHaveBeenCalled();
    expect(summaries.findByMbids).toHaveBeenCalledExactlyOnceWith(['x', 'y']);
  });

  it('returns the summaries in the order the lyrics index ranked them', async () => {
    const { service } = setup(['b', 'a']);

    const { results } = await service.search({ ...params, offset: 0 });

    expect(results.map((result) => result.mbid)).toEqual(['b', 'a']);
  });
});
