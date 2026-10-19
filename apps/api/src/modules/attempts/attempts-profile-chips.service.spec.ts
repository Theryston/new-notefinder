import { Test } from '@nestjs/testing';
import { TracksService } from '../tracks/tracks.service.js';
import type { ProfileAttemptRow } from './attempts.repository.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';

const repository = {
  listProfileAttempts: vi.fn(),
};
const tracks = { assertTrackExists: vi.fn() };

// One joined row per (attempt, credited artist), as the repository returns it.
const joined = (
  overrides: Partial<ProfileAttemptRow> = {},
): ProfileAttemptRow => ({
  attemptId: 'attempt-1',
  transposeSemitones: 0,
  accuracy: 0.9,
  forwardSkip: false,
  bleedSuspected: false,
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
  trackVocalRangeLowest: 48,
  trackVocalRangeHighest: 72,
  artistId: 'artist-a',
  artistName: 'Artist A',
  ...overrides,
});

describe('AttemptsService.profileChips', () => {
  let service: AttemptsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: AttemptsRepository, useValue: repository },
        { provide: TracksService, useValue: tracks },
      ],
    }).compile();
    service = moduleRef.get(AttemptsService);
  });

  it('reads the attempts of the User once', async () => {
    repository.listProfileAttempts.mockResolvedValue([]);

    await service.profileChips('user-1');

    expect(repository.listProfileAttempts).toHaveBeenCalledWith('user-1');
  });

  it('answers null chips for a User with no attempts', async () => {
    repository.listProfileAttempts.mockResolvedValue([]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: null,
      mostSungArtist: null,
    });
  });

  it('regroups the joined rows of an attempt with its artists', async () => {
    repository.listProfileAttempts.mockResolvedValue([
      joined({ artistId: 'artist-a', artistName: 'Artist A' }),
      joined({ artistId: 'artist-b', artistName: 'Artist B' }),
      joined({
        attemptId: 'attempt-2',
        createdAt: new Date('2026-10-02T10:00:00.000Z'),
        artistId: 'artist-b',
        artistName: 'Artist B',
      }),
    ]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: { lowest: 48, highest: 72 },
      // Artist B has two attempts (attempt 1 and 2), Artist A one.
      mostSungArtist: { id: 'artist-b', name: 'Artist B' },
    });
  });

  it('counts an attempt once even when its Track credits no artist', async () => {
    repository.listProfileAttempts.mockResolvedValue([
      joined({ artistId: null, artistName: null }),
    ]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: { lowest: 48, highest: 72 },
      mostSungArtist: null,
    });
  });

  it('reads a Track without notes as no vocal range', async () => {
    repository.listProfileAttempts.mockResolvedValue([
      joined({ trackVocalRangeLowest: null, trackVocalRangeHighest: null }),
    ]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: null,
      mostSungArtist: { id: 'artist-a', name: 'Artist A' },
    });
  });
});
