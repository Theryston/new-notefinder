import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { LyricsService } from '../lyrics/lyrics.service.js';
import type { RecordingRepository } from './recording.repository.js';
import { RecordingService } from './recording.service.js';
import type { RecordingRow } from './recording-data.js';

const MBID = '00000000-0000-4000-8000-000000000100';

const row: RecordingRow = {
  id: 7,
  mbid: MBID,
  title: 'Song',
  lengthMs: null,
  disambiguation: '',
  video: false,
  artistCreditId: 3,
  artistCreditName: 'Artist',
};

const setup = (lyrics?: LyricsService) => {
  const repository = {
    findByMbid: vi.fn(async () => row),
    findMergedInto: vi.fn(async () => undefined),
    findCreditedArtists: vi.fn(async () => []),
    findIsrcs: vi.fn(async () => []),
    findReleases: vi.fn(async () => []),
    findReleaseEvents: vi.fn(async () => []),
    findWorks: vi.fn(async () => []),
    findExternalUrls: vi.fn(async () => []),
    findTagLevels: vi.fn(async () => ({
      recording: [],
      release_group: [],
      artist: [],
    })),
  };
  const bootstrap = { assertReady: vi.fn(async () => undefined) };
  const service = new RecordingService(
    repository as unknown as RecordingRepository,
    bootstrap as unknown as BootstrapService,
    lyrics,
  );
  return { service, repository };
};

describe('RecordingService with Lyrics', () => {
  it('fills the Lyrics of a matched Recording, plain and synced', async () => {
    const lyrics = {
      getLyrics: vi.fn(async () => ({
        plain: 'words',
        synced: '[00:01.00] words',
      })),
    };
    const { service } = setup(lyrics as unknown as LyricsService);

    await expect(service.getRecording(MBID)).resolves.toMatchObject({
      mbid: MBID,
      lyrics: { plain: 'words', synced: '[00:01.00] words' },
    });
    expect(lyrics.getLyrics).toHaveBeenCalledExactlyOnceWith(MBID);
  });

  it('answers null Lyrics when nothing matched, reading them anyway', async () => {
    const lyrics = {
      getLyrics: vi.fn(async () => ({ plain: null, synced: null })),
    };
    const { service } = setup(lyrics as unknown as LyricsService);

    await expect(service.getRecording(MBID)).resolves.toMatchObject({
      lyrics: { plain: null, synced: null },
    });
    expect(lyrics.getLyrics).toHaveBeenCalledExactlyOnceWith(MBID);
  });

  it('answers null Lyrics without a Lyrics service, as the older specs do', async () => {
    const { service } = setup(undefined);

    await expect(service.getRecording(MBID)).resolves.toMatchObject({
      lyrics: { plain: null, synced: null },
    });
  });
});
