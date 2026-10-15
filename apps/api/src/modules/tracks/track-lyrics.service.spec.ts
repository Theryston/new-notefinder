import { Test } from '@nestjs/testing';
import { TrackLyricsRepository } from './track-lyrics.repository.js';
import { TrackLyricsService } from './track-lyrics.service.js';
import { TrackProcessingService } from './track-processing.service.js';

const lyrics = { findTimedLyrics: vi.fn() };
const processing = { assertTrackExists: vi.fn() };

const line = {
  start: 1,
  end: 3,
  words: [
    { text: 'Hello', start: 1, end: 2 },
    { text: 'world', start: 2, end: 3 },
  ],
};

describe('TrackLyricsService', () => {
  let service: TrackLyricsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackLyricsService,
        { provide: TrackLyricsRepository, useValue: lyrics },
        { provide: TrackProcessingService, useValue: processing },
      ],
    }).compile();
    service = moduleRef.get(TrackLyricsService);
  });

  it('answers the lines without looking the Track up', async () => {
    lyrics.findTimedLyrics.mockResolvedValue([line]);

    await expect(service.getLyrics('track-1')).resolves.toEqual({
      lines: [line],
    });
    expect(processing.assertTrackExists).not.toHaveBeenCalled();
  });

  it('checks that a Track without lines exists, and answers none for one that does', async () => {
    lyrics.findTimedLyrics.mockResolvedValue([]);
    processing.assertTrackExists.mockResolvedValue(undefined);

    await expect(service.getLyrics('track-1')).resolves.toEqual({ lines: [] });
    expect(processing.assertTrackExists).toHaveBeenCalledWith('track-1');
  });

  it('lets the unknown or moved ID error through', async () => {
    lyrics.findTimedLyrics.mockResolvedValue([]);
    processing.assertTrackExists.mockRejectedValue(new Error('moved'));

    await expect(service.getLyrics('legacy')).rejects.toThrow('moved');
  });
});
