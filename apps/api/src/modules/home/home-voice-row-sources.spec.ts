import type { HomeTrackRecord } from './home.repository.js';
import { createVoiceRowSources } from './home-voice-row-sources.js';

const record = (
  id: string,
  vocalRangeLowest: number | null,
  vocalRangeHighest: number | null,
): HomeTrackRecord => ({
  id,
  title: `Track ${id}`,
  coverUrl: null,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  lengthMs: 180_000,
  vocalRangeLowest,
  vocalRangeHighest,
});

describe('the by-voice row sources', () => {
  const repository = { findTracksWithVocalRange: vi.fn() };

  const load = async (rowId: string) => {
    const source = createVoiceRowSources(repository).find(
      (row) => row.id === rowId,
    );
    return source?.load();
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repository.findTracksWithVocalRange.mockResolvedValue([
      record('narrow', 60, 64),
      record('high', 66, 78),
      record('low', 40, 52),
    ]);
  });

  it('offers the three rows, all in the vocal-range layout', () => {
    const sources = createVoiceRowSources(repository);

    expect(sources.map((source) => [source.id, source.layout])).toEqual([
      ['by-voice-easy-start', 'vocal-range'],
      ['by-voice-higher-voices', 'vocal-range'],
      ['by-voice-lower-voices', 'vocal-range'],
    ]);
    expect(sources.map((source) => source.title?.key)).toEqual([
      'home.rows.easyToStart',
      'home.rows.higherVoices',
      'home.rows.lowerVoices',
    ]);
  });

  it('loads the Tracks of each voice row from the stored Vocal range', async () => {
    expect((await load('by-voice-easy-start'))?.map((c) => c.id)).toEqual([
      'narrow',
    ]);
    expect((await load('by-voice-higher-voices'))?.map((c) => c.id)).toEqual([
      'high',
    ]);
    expect((await load('by-voice-lower-voices'))?.map((c) => c.id)).toEqual([
      'low',
    ]);
  });

  it('marks each candidate as having a Vocal range', async () => {
    const [candidate] = (await load('by-voice-easy-start')) ?? [];

    expect(candidate).toMatchObject({
      vocalRange: { lowest: 60, highest: 64 },
      hasVocalRange: true,
    });
  });

  it('asks the repository for the completed Tracks with a range, bounded', async () => {
    await load('by-voice-easy-start');

    expect(repository.findTracksWithVocalRange).toHaveBeenCalledWith(200);
  });
});
