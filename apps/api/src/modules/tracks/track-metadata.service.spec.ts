import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TRACK_METADATA_QUEUE } from './track-metadata.job.js';
import { TrackMetadataService } from './track-metadata.service.js';
import { TrackMetadataImportService } from './track-metadata-import.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';

// The metadata import's policy: which job an enqueue makes, what a run refreshes
// and how a failure is handled. The queue and the importer are fakes.

const queue = { add: vi.fn() };
const processings = { findLatestProcessing: vi.fn() };
const importer = { importMetadata: vi.fn() };
const revalidation = { revalidate: vi.fn() };

const LINKED = {
  artistIds: ['artist-1'],
  albumIds: ['album-1'],
};

const latestOf = (status: string) => ({ id: 'processing-2', status });

describe('TrackMetadataService', () => {
  let service: TrackMetadataService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    queue.add.mockResolvedValue(undefined);
    revalidation.revalidate.mockResolvedValue(undefined);
    importer.importMetadata.mockResolvedValue(LINKED);
    processings.findLatestProcessing.mockResolvedValue(latestOf('COMPLETED'));
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackMetadataService,
        { provide: getQueueToken(TRACK_METADATA_QUEUE), useValue: queue },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: TrackMetadataImportService, useValue: importer },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(TrackMetadataService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('enqueueImport', () => {
    it('queues the import under the newest Processing, so every Processing gets its own job', async () => {
      processings.findLatestProcessing.mockResolvedValue(latestOf('QUEUED'));

      await service.enqueueImport('track-1');

      expect(processings.findLatestProcessing).toHaveBeenCalledWith('track-1');
      expect(queue.add).toHaveBeenCalledWith(
        'import-metadata',
        { trackId: 'track-1' },
        { jobId: 'metadata-processing-2' },
      );
    });

    it('queues nothing for a Track that has no Processing', async () => {
      processings.findLatestProcessing.mockResolvedValue(undefined);

      await service.enqueueImport('track-1');

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('imports the Track, then refreshes the pages of its Artists and Albums once it is completed', async () => {
      await service.run({ trackId: 'track-1' }, true);

      expect(importer.importMetadata).toHaveBeenCalledWith('track-1');
      expect(revalidation.revalidate).toHaveBeenCalledWith([
        'artist:artist-1',
        'artist:artist-1:tracks',
        'album:album-1',
        'album:album-1:tracks',
      ]);
    });

    it('leaves the pages alone while the Track is still processing, since they do not show it yet', async () => {
      processings.findLatestProcessing.mockResolvedValue(
        latestOf('FINDING_VIDEO'),
      );

      await service.run({ trackId: 'track-1' }, true);

      expect(importer.importMetadata).toHaveBeenCalledWith('track-1');
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });

    it('refreshes nothing when the import linked nothing', async () => {
      importer.importMetadata.mockResolvedValue({
        artistIds: [],
        albumIds: [],
      });

      await service.run({ trackId: 'track-1' }, true);

      expect(processings.findLatestProcessing).not.toHaveBeenCalled();
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });

    it('throws a failure that is not on the last attempt, so BullMQ retries the import', async () => {
      importer.importMetadata.mockRejectedValue(new Error('catalog is down'));

      await expect(service.run({ trackId: 'track-1' }, false)).rejects.toThrow(
        'catalog is down',
      );
    });

    it('logs a failure on the last attempt and leaves the Processing alone', async () => {
      importer.importMetadata.mockRejectedValue(new Error('catalog is down'));

      await expect(
        service.run({ trackId: 'track-1' }, true),
      ).resolves.toBeUndefined();
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });
  });
});
