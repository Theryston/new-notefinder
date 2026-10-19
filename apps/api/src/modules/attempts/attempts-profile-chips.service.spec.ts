import { Test } from '@nestjs/testing';
import { TracksService } from '../tracks/tracks.service.js';
import type {
  ArtistGroupRow,
  VocalRangeGroupRow,
} from './attempts.repository.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';

const repository = {
  listVocalRangeGroups: vi.fn(),
  listArtistGroups: vi.fn(),
};
const tracks = { assertTrackExists: vi.fn() };

const vocalRow = (
  overrides: Partial<VocalRangeGroupRow> = {},
): VocalRangeGroupRow => ({
  trackVocalRangeLowest: 48,
  trackVocalRangeHighest: 72,
  transposeSemitones: 0,
  forwardSkip: false,
  bleedSuspected: false,
  bestAccuracy: 0.9,
  ...overrides,
});

const artistRow = (
  overrides: Partial<ArtistGroupRow> = {},
): ArtistGroupRow => ({
  artistId: 'artist-a',
  artistName: 'Artist A',
  bleedSuspected: false,
  attempts: 1,
  lastAttemptAt: new Date('2026-10-01T10:00:00.000Z'),
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

  it('reads the grouped runs of the User', async () => {
    repository.listVocalRangeGroups.mockResolvedValue([]);
    repository.listArtistGroups.mockResolvedValue([]);

    await service.profileChips('user-1');

    expect(repository.listVocalRangeGroups).toHaveBeenCalledWith('user-1');
    expect(repository.listArtistGroups).toHaveBeenCalledWith('user-1');
  });

  it('answers null chips for a User with no runs', async () => {
    repository.listVocalRangeGroups.mockResolvedValue([]);
    repository.listArtistGroups.mockResolvedValue([]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: null,
      mostSungArtist: null,
    });
  });

  it('maps the grouped rows into the chip rules', async () => {
    repository.listVocalRangeGroups.mockResolvedValue([
      vocalRow({ transposeSemitones: 2 }),
    ]);
    repository.listArtistGroups.mockResolvedValue([
      artistRow({ artistId: 'artist-a', artistName: 'Artist A', attempts: 1 }),
      artistRow({ artistId: 'artist-b', artistName: 'Artist B', attempts: 3 }),
    ]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: { lowest: 50, highest: 74 },
      mostSungArtist: { id: 'artist-b', name: 'Artist B' },
    });
  });

  it('reads a Track without notes as no vocal range', async () => {
    repository.listVocalRangeGroups.mockResolvedValue([
      vocalRow({ trackVocalRangeLowest: null, trackVocalRangeHighest: null }),
    ]);
    repository.listArtistGroups.mockResolvedValue([artistRow()]);

    await expect(service.profileChips('user-1')).resolves.toEqual({
      vocalRange: null,
      mostSungArtist: { id: 'artist-a', name: 'Artist A' },
    });
  });
});
