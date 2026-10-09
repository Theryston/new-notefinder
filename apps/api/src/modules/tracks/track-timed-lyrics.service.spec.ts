import { Test, type TestingModule } from '@nestjs/testing';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { TrackLyricsRepository } from './track-lyrics.repository.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackTimedLyricsService } from './track-timed-lyrics.service.js';

// The guarded write of Timed lyrics: the lines are written only while the
// Processing is in its lyrics stage. The rows are fakes; the e2e spec runs the
// real ones.

// `replace` is `@Transactional()`: the database module runs it on a stand-in
// transaction client, so the write path runs without a database.
const tx = { name: 'tx' };
const db = {
  name: 'db',
  transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  ),
};
const pool = { end: vi.fn(async () => {}) };

const processings = { lockLyricsStage: vi.fn() };
const lyrics = { replaceTimedLyrics: vi.fn() };

const LINES = [
  {
    start: 1,
    end: 2,
    words: [{ text: 'Is', start: 1.1, end: 1.3 }],
  },
];

describe('TrackTimedLyricsService', () => {
  let service: TrackTimedLyricsService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    processings.lockLyricsStage.mockResolvedValue(true);
    lyrics.replaceTimedLyrics.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        TrackTimedLyricsService,
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: TrackLyricsRepository, useValue: lyrics },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(TrackTimedLyricsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('writes the lines of the Track while the Processing is in its lyrics stage', async () => {
    await expect(
      service.replace({ id: 'processing-1', trackId: 'track-1' }, LINES),
    ).resolves.toBe(true);

    expect(processings.lockLyricsStage).toHaveBeenCalledWith('processing-1');
    expect(lyrics.replaceTimedLyrics).toHaveBeenCalledWith('track-1', LINES);
  });

  it('writes nothing when the Processing has moved on', async () => {
    processings.lockLyricsStage.mockResolvedValue(false);

    await expect(
      service.replace({ id: 'processing-1', trackId: 'track-1' }, LINES),
    ).resolves.toBe(false);

    expect(lyrics.replaceTimedLyrics).not.toHaveBeenCalled();
  });

  it('clears the Track when it is given no lines', async () => {
    await service.replace({ id: 'processing-1', trackId: 'track-1' }, []);

    expect(lyrics.replaceTimedLyrics).toHaveBeenCalledWith('track-1', []);
  });
});
