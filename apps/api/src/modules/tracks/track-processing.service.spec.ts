import { Test } from '@nestjs/testing';
import { trackProcessingStateSchema } from '@notefinder/contracts';
import { TrackContributorRepository } from './track-contributor.repository.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import { TracksRepository } from './tracks.repository.js';

const tracks = {
  findTrackHeader: vi.fn(),
  findTrackIdByLegacyId: vi.fn(),
};
const processings = {
  findLatestProcessing: vi.fn(),
};
const contributors = {
  findContributorsPage: vi.fn(),
};

const header = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
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

const row = (
  id: string,
  username: string | null,
  name: string,
  image: string | null = null,
) => ({
  id,
  username,
  name,
  image,
  contributedAt: new Date('2026-10-08T12:00:00.000Z'),
});

describe('TrackProcessingService', () => {
  let service: TrackProcessingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findTrackHeader.mockResolvedValue(undefined);
    processings.findLatestProcessing.mockResolvedValue(undefined);
    contributors.findContributorsPage.mockResolvedValue({ rows: [], total: 0 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackProcessingService,
        { provide: TracksRepository, useValue: tracks },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: TrackContributorRepository, useValue: contributors },
      ],
    }).compile();
    service = moduleRef.get(TrackProcessingService);
  });

  it('shows the header, the latest Processing and the Contributors', async () => {
    tracks.findTrackHeader.mockResolvedValue(header);
    processings.findLatestProcessing.mockResolvedValue(latestRow);
    contributors.findContributorsPage.mockResolvedValue({
      rows: [
        row('contributor-1', 'ada', 'Ada'),
        row('contributor-2', null, 'Grace'),
      ],
      total: 2,
    });

    const state = await service.getProcessingState('track-1');

    expect(state).toEqual({
      track: {
        id: 'track-1',
        title: 'Bohemian Rhapsody',
        coverUrl: null,
        artistCredit: [{ name: 'Queen', joinPhrase: '' }],
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
        {
          id: 'contributor-1',
          username: 'ada',
          name: 'Ada',
          image: null,
        },
        {
          id: 'contributor-2',
          username: null,
          name: 'Grace',
          image: null,
        },
      ],
      contributorCount: 2,
    });
    expect(trackProcessingStateSchema.parse(state)).toEqual(state);
  });

  it('answers a Track that never had a Processing with a null Processing', async () => {
    tracks.findTrackHeader.mockResolvedValue(header);

    const state = await service.getProcessingState('track-1');

    expect(state.processing).toBeNull();
    expect(state.contributors).toEqual([]);
    expect(state.contributorCount).toBe(0);
  });

  it('shows a Contributor without a Username unlinked, with a null Username', async () => {
    tracks.findTrackHeader.mockResolvedValue(header);
    contributors.findContributorsPage.mockResolvedValue({
      rows: [row('contributor-1', null, 'Ada')],
      total: 1,
    });

    const state = await service.getProcessingState('track-1');

    expect(state.contributors).toEqual([
      { id: 'contributor-1', username: null, name: 'Ada', image: null },
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
