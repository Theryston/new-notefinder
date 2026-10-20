import type { HomeTrackRecord } from './home.repository.js';
import { createHomeRowSources, inRankOrder } from './home-row-sources.js';

const record = (id: string): HomeTrackRecord => ({
  id,
  title: `Track ${id}`,
  coverUrl: `https://cdn.example/${id}.webp`,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  lengthMs: 180_000,
  vocalRangeLowest: 60,
  vocalRangeHighest: 72,
});

describe('inRankOrder', () => {
  it('orders the records as the ranked ids name them', () => {
    const records = [record('a'), record('b'), record('c')];

    expect(inRankOrder(records, ['c', 'a', 'b']).map((r) => r.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('skips an id with no record, a Track that is no longer completed', () => {
    expect(inRankOrder([record('a')], ['gone', 'a']).map((r) => r.id)).toEqual([
      'a',
    ]);
  });
});

describe('the trending row sources', () => {
  const repository = {
    findTrendingTracks: vi.fn(),
    findNewestTracks: vi.fn(),
    findCompletedTracksByIds: vi.fn(),
  };
  const ranking = { rank: vi.fn() };

  const trendingLoad = async (locale: 'en' | 'pt-BR') => {
    const source = createHomeRowSources(repository, ranking).find(
      (row) => row.id === 'trending-today',
    );
    return source?.load(locale);
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repository.findTrendingTracks.mockResolvedValue([record('global')]);
    repository.findNewestTracks.mockResolvedValue([]);
  });

  it('falls back to the global trending figures when the locale has no ranking', async () => {
    ranking.rank.mockResolvedValue(undefined);

    const items = await trendingLoad('pt-BR');

    expect(ranking.rank).toHaveBeenCalledWith('pt-BR');
    expect(repository.findTrendingTracks).toHaveBeenCalledWith(60);
    expect(repository.findCompletedTracksByIds).not.toHaveBeenCalled();
    expect(items?.map((item) => item.id)).toEqual(['global']);
  });

  it('loads the locale ranking in its own order', async () => {
    ranking.rank.mockResolvedValue([
      { trackId: 'b', score: 9 },
      { trackId: 'a', score: 5 },
    ]);
    repository.findCompletedTracksByIds.mockResolvedValue([
      record('a'),
      record('b'),
    ]);

    const items = await trendingLoad('en');

    expect(repository.findCompletedTracksByIds).toHaveBeenCalledWith([
      'b',
      'a',
    ]);
    expect(repository.findTrendingTracks).not.toHaveBeenCalled();
    expect(items?.map((item) => item.id)).toEqual(['b', 'a']);
  });
});
