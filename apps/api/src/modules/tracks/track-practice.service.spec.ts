import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { TrackPracticeRepository } from './track-practice.repository.js';
import { TrackPracticeService } from './track-practice.service.js';
import { TrackProcessingService } from './track-processing.service.js';

const practice = { findPracticeRow: vi.fn(), findNotes: vi.fn() };
const processing = {
  throwMovedOrMissing: vi.fn(),
  assertTrackExists: vi.fn(),
  contributorsOf: vi.fn(),
};

const row = {
  id: 'track-1',
  title: 'Under Pressure',
  coverUrl: null,
  artistCredit: [
    { name: 'Beyonce', joinPhrase: ' & ', mbid: 'mbid-queen' },
    { name: 'David Bowie', joinPhrase: '', mbid: 'mbid-unlinked' },
    { name: 'Old Credit', joinPhrase: '' },
  ],
  lengthMs: 248_000,
  youtubeVideoId: 'a01QQZyl-_I',
  artists: [{ id: 'artist-1', mbid: 'mbid-queen' }],
  hasNotes: true,
};

describe('TrackPracticeService', () => {
  let service: TrackPracticeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    processing.contributorsOf.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackPracticeService,
        { provide: TrackPracticeRepository, useValue: practice },
        { provide: TrackProcessingService, useValue: processing },
      ],
    }).compile();
    service = moduleRef.get(TrackPracticeService);
  });

  it('links each credited name to its Artist by MBID, whatever the name prints', async () => {
    practice.findPracticeRow.mockResolvedValue(row);

    const header = await service.getHeader('track-1');

    expect(header.artistCredit).toEqual([
      { name: 'Beyonce', joinPhrase: ' & ', artistId: 'artist-1' },
      { name: 'David Bowie', joinPhrase: '', artistId: null },
      { name: 'Old Credit', joinPhrase: '', artistId: null },
    ]);
    expect(header).toMatchObject({
      durationMs: 248_000,
      youtubeVideoId: 'a01QQZyl-_I',
      hasNotes: true,
    });
  });

  it('hands an unknown header ID to the moved-or-missing answer', async () => {
    practice.findPracticeRow.mockResolvedValue(undefined);
    processing.throwMovedOrMissing.mockRejectedValue(
      new AppException('NOT_FOUND', 'Track not found'),
    );

    await expect(service.getHeader('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns the notes without checking the Track when there are some', async () => {
    practice.findNotes.mockResolvedValue([
      { note: 'C#', octave: 3, start: 1, end: 2 },
    ]);

    await expect(service.getNotes('track-1')).resolves.toEqual({
      notes: [{ note: 'C#', octave: 3, start: 1, end: 2 }],
    });
    expect(processing.assertTrackExists).not.toHaveBeenCalled();
  });

  it('checks that a Track without notes exists', async () => {
    practice.findNotes.mockResolvedValue([]);
    processing.assertTrackExists.mockRejectedValue(
      new AppException('NOT_FOUND', 'Track not found'),
    );

    await expect(service.getNotes('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
