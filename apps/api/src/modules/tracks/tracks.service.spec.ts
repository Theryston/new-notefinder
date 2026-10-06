import { Test } from '@nestjs/testing';
import { searchResultItemSchema } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { recordingSummary } from '../../../test/utils/recording-summaries.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

describe('TracksService', () => {
  let service: TracksService;
  const repository = {
    findTrackIdsByRecordingMbids: vi.fn(),
  };

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

  describe('findTrackIdsByRecordingMbids', () => {
    it('returns the Track ids the repository found', async () => {
      const mbid = testMbid(1);
      repository.findTrackIdsByRecordingMbids.mockResolvedValue(
        new Map([[mbid, 'track-1']]),
      );

      const trackIds = await service.findTrackIdsByRecordingMbids([mbid]);

      expect(repository.findTrackIdsByRecordingMbids).toHaveBeenCalledWith([
        mbid,
      ]);
      expect(trackIds.get(mbid)).toBe('track-1');
    });
  });

  describe('attachTrackIds', () => {
    beforeEach(() => {
      repository.findTrackIdsByRecordingMbids.mockImplementation(
        async (mbids: string[]) =>
          new Map(
            mbids
              .filter((mbid) => mbid === testMbid(1))
              .map((mbid) => [mbid, 'track-1']),
          ),
      );
    });

    it('attaches the Track id when the Recording was processed', async () => {
      const [item] = await service.attachTrackIds([
        recordingSummary(testMbid(1), 'Linked Song'),
      ]);

      expect(item).toMatchObject({ trackId: 'track-1' });
      expect(searchResultItemSchema.parse(item)).toEqual(item);
    });

    it('attaches null when the Recording has no Track yet', async () => {
      const [item] = await service.attachTrackIds([
        recordingSummary(testMbid(2), 'Unprocessed Song'),
      ]);

      expect(item).toMatchObject({
        mbid: testMbid(2),
        title: 'Unprocessed Song',
        trackId: null,
      });
      expect(searchResultItemSchema.parse(item)).toEqual(item);
    });

    it('looks every hit up in one call and keeps the catalog order', async () => {
      const items = await service.attachTrackIds([
        recordingSummary(testMbid(2), 'Second'),
        recordingSummary(testMbid(1), 'First'),
      ]);

      expect(repository.findTrackIdsByRecordingMbids).toHaveBeenCalledTimes(1);
      expect(repository.findTrackIdsByRecordingMbids).toHaveBeenCalledWith([
        testMbid(2),
        testMbid(1),
      ]);
      expect(items.map((item) => [item.title, item.trackId])).toEqual([
        ['Second', null],
        ['First', 'track-1'],
      ]);
    });

    it('attaches nothing to no hits', async () => {
      await expect(service.attachTrackIds([])).resolves.toEqual([]);
    });
  });
});
