import { Test } from '@nestjs/testing';
import { testMbid } from '../../../test/utils/factories.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

describe('TracksService', () => {
  const repository = { findTrackIdsByRecordingMbids: vi.fn() };
  let service: TracksService;

  beforeEach(async () => {
    repository.findTrackIdsByRecordingMbids.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TracksService,
        { provide: TracksRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(TracksService);
  });

  it('returns Track ids by Recording MBID for request deduplication', async () => {
    const mbid = testMbid(1);
    repository.findTrackIdsByRecordingMbids.mockResolvedValue(
      new Map([[mbid, 'track-1']]),
    );
    const ids = await service.findTrackIdsByRecordingMbids([mbid]);
    expect(repository.findTrackIdsByRecordingMbids).toHaveBeenCalledWith([
      mbid,
    ]);
    expect(ids.get(mbid)).toBe('track-1');
  });
});
