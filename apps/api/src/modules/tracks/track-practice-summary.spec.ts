import { Test } from '@nestjs/testing';
import { TrackPracticeRepository } from './track-practice.repository.js';
import { TrackPracticeService } from './track-practice.service.js';
import { TrackProcessingService } from './track-processing.service.js';

const practice = { findPracticeRow: vi.fn(), findNotes: vi.fn() };
const processing = {
  throwMovedOrMissing: vi.fn(),
  assertTrackExists: vi.fn(),
  listContributors: vi.fn(),
  contributorCount: vi.fn(),
};

const row = {
  id: 'track-1',
  title: 'Under Pressure',
  coverUrl: null,
  artistCredit: [],
  lengthMs: 248_000,
  youtubeVideoId: null,
  artists: [],
  hasNotes: true,
  vocalRangeLowest: 62,
  vocalRangeHighest: 74,
  keyTonic: 7,
  keyMode: 'MAJOR',
};

describe('TrackPracticeService header summary', () => {
  let service: TrackPracticeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    processing.listContributors.mockResolvedValue({
      items: [],
      nextCursor: null,
      total: 0,
    });
    processing.contributorCount.mockResolvedValue(0);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackPracticeService,
        { provide: TrackPracticeRepository, useValue: practice },
        { provide: TrackProcessingService, useValue: processing },
      ],
    }).compile();
    service = moduleRef.get(TrackPracticeService);
  });

  it('returns the vocal range and the key the Track keeps', async () => {
    practice.findPracticeRow.mockResolvedValue(row);

    const header = await service.getHeader('track-1');

    expect(header.vocalRange).toEqual({ lowest: 62, highest: 74 });
    expect(header.key).toEqual({ tonic: 7, mode: 'MAJOR' });
  });

  it('leaves both out for a Track without them', async () => {
    practice.findPracticeRow.mockResolvedValue({
      ...row,
      hasNotes: false,
      vocalRangeLowest: null,
      vocalRangeHighest: null,
      keyTonic: null,
      keyMode: null,
    });

    const header = await service.getHeader('track-1');

    expect(header).not.toHaveProperty('vocalRange');
    expect(header).not.toHaveProperty('key');
  });

  it('leaves out the key alone when only the range is known', async () => {
    practice.findPracticeRow.mockResolvedValue({
      ...row,
      keyTonic: null,
      keyMode: null,
    });

    const header = await service.getHeader('track-1');

    expect(header.vocalRange).toEqual({ lowest: 62, highest: 74 });
    expect(header).not.toHaveProperty('key');
  });
});
