import { Test } from '@nestjs/testing';
import { trackProcessingStateSchema } from '@notefinder/contracts';
import { UsersService } from '../users/users.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TracksRepository } from './tracks.repository.js';

const tracks = {
  findTrackHeader: vi.fn(),
  findTrackArtists: vi.fn(),
  findTrackIdByLegacyId: vi.fn(),
};
const processings = {
  findLatestProcessing: vi.fn(),
  findContributorUserIds: vi.fn(),
};
const users = { findPublicUsers: vi.fn() };

const header = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  coverUrl: null,
};

const latestRow = {
  id: 'processing-2',
  status: 'FAILED' as const,
  failureCode: 'DOWNLOAD_FAILED' as const,
  resumeFrom: 'DOWNLOADING_AUDIO' as const,
  videoId: 'dQw4w9WgXcQ',
  videoSource: 'musicbrainz' as const,
  createdAt: new Date('2026-10-08T12:00:00.000Z'),
  startedAt: new Date('2026-10-08T12:00:05.000Z'),
  finishedAt: new Date('2026-10-08T12:01:00.000Z'),
};

const profile = (id: string, name: string, username: string | null) => ({
  id,
  name,
  username,
  image: null,
});

describe('TrackProcessingService', () => {
  let service: TrackProcessingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findTrackHeader.mockResolvedValue(undefined);
    tracks.findTrackArtists.mockResolvedValue([]);
    processings.findLatestProcessing.mockResolvedValue(undefined);
    processings.findContributorUserIds.mockResolvedValue([]);
    users.findPublicUsers.mockResolvedValue(new Map());
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackProcessingService,
        { provide: TracksRepository, useValue: tracks },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = moduleRef.get(TrackProcessingService);
  });

  it('shows the header, the latest Processing and the Contributors', async () => {
    tracks.findTrackHeader.mockResolvedValue(header);
    tracks.findTrackArtists.mockResolvedValue([
      { id: 'artist-1', name: 'Queen' },
    ]);
    processings.findLatestProcessing.mockResolvedValue(latestRow);
    processings.findContributorUserIds.mockResolvedValue(['user-1', 'user-2']);
    users.findPublicUsers.mockResolvedValue(
      new Map([
        ['user-1', profile('user-1', 'Ada', 'ada')],
        ['user-2', profile('user-2', 'Grace', null)],
      ]),
    );

    const state = await service.getProcessingState('track-1');

    expect(state).toEqual({
      track: {
        id: 'track-1',
        title: 'Bohemian Rhapsody',
        coverUrl: null,
        artists: [{ id: 'artist-1', name: 'Queen' }],
      },
      processing: expect.objectContaining({
        id: 'processing-2',
        status: 'FAILED',
        failureCode: 'DOWNLOAD_FAILED',
        retryable: true,
        resumeFrom: 'DOWNLOADING_AUDIO',
        video: { id: 'dQw4w9WgXcQ', source: 'musicbrainz' },
        createdAt: '2026-10-08T12:00:00.000Z',
      }),
      contributors: [
        { username: 'ada', name: 'Ada', image: null },
        { username: null, name: 'Grace', image: null },
      ],
    });
    expect(trackProcessingStateSchema.parse(state)).toEqual(state);
    expect(users.findPublicUsers).toHaveBeenCalledWith(['user-1', 'user-2']);
  });

  it('answers a Track that never had a Processing with a null Processing', async () => {
    tracks.findTrackHeader.mockResolvedValue(header);

    const state = await service.getProcessingState('track-1');

    expect(state.processing).toBeNull();
    expect(state.contributors).toEqual([]);
  });

  it('leaves out a Contributor whose account no longer exists', async () => {
    tracks.findTrackHeader.mockResolvedValue(header);
    processings.findContributorUserIds.mockResolvedValue(['user-1', 'gone']);
    users.findPublicUsers.mockResolvedValue(
      new Map([['user-1', profile('user-1', 'Ada', 'ada')]]),
    );

    const state = await service.getProcessingState('track-1');

    expect(state.contributors).toEqual([
      { username: 'ada', name: 'Ada', image: null },
    ]);
  });

  it('answers a legacy Track ID with RESOURCE_MOVED and the new ID', async () => {
    tracks.findTrackIdByLegacyId.mockResolvedValue('track-new');

    await expect(service.getProcessingState('legacy-1')).rejects.toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: 'track-new' },
    });
    expect(tracks.findTrackIdByLegacyId).toHaveBeenCalledWith('legacy-1');
  });

  it('answers an unknown Track ID with NOT_FOUND', async () => {
    tracks.findTrackIdByLegacyId.mockResolvedValue(undefined);

    await expect(service.getProcessingState('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
