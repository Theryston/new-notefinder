import type { RecordingLyrics } from '@notefinder/contracts';
import type { LyricsRepository } from './lyrics.repository.js';
import { LyricsService } from './lyrics.service.js';

const serviceWith = (
  rows: Record<string, { plain: string | null; synced: string | null }>,
): LyricsService => {
  const repository = {
    findByMbid: async (mbid: string) => rows[mbid],
  };
  return new LyricsService(repository as unknown as LyricsRepository);
};

describe('LyricsService', () => {
  it('returns the kept Lyrics of a matched Recording', async () => {
    const service = serviceWith({
      mbid: { plain: 'words', synced: '[00:01.00] words' },
    });

    await expect(service.getLyrics('mbid')).resolves.toEqual({
      plain: 'words',
      synced: '[00:01.00] words',
    });
  });

  it('returns null Lyrics when nothing matched', async () => {
    const service = serviceWith({});

    await expect(service.getLyrics('missing')).resolves.toEqual({
      plain: null,
      synced: null,
    } satisfies RecordingLyrics);
  });

  it('builds one document per kept Lyrics, skipping the textless', async () => {
    const repository = {
      findLyricsDocuments: async () => [
        { recordingId: 1, mbid: 'a', plain: 'words', synced: null },
        {
          recordingId: 2,
          mbid: 'b',
          plain: null,
          synced: '[00:01.00] timed words',
        },
        { recordingId: 3, mbid: 'c', plain: null, synced: null },
      ],
    };
    const service = new LyricsService(
      repository as unknown as LyricsRepository,
    );

    await expect(service.findDocuments(0, 100)).resolves.toEqual([
      { mbid: 'a', lyrics: 'words' },
      { mbid: 'b', lyrics: 'timed words' },
    ]);
  });
});
