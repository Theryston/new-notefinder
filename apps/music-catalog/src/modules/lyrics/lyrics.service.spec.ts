import type { LyricsRepository } from './lyrics.repository.js';
import { LyricsService } from './lyrics.service.js';

describe('LyricsService', () => {
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
