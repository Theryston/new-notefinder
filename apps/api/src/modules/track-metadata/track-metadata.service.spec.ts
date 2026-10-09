import { Test, type TestingModule } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { TrackMetadataService } from './track-metadata.service.js';
import { TrackMetadataImportService } from './track-metadata-import.service.js';

// One import attempt: what it imports, which pages it refreshes and how a
// failure is handled. The importer, the Tracks and the revalidation are fakes.

const importer = { importMetadata: vi.fn() };
const tracks = { findRecordingMbid: vi.fn(), isTrackCompleted: vi.fn() };
const revalidation = { revalidate: vi.fn() };

const LINKED = { artistIds: ['artist-1'], albumIds: ['album-1'] };

describe('TrackMetadataService', () => {
  let service: TrackMetadataService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findRecordingMbid.mockResolvedValue('recording-1');
    tracks.isTrackCompleted.mockResolvedValue(true);
    importer.importMetadata.mockResolvedValue(LINKED);
    revalidation.revalidate.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackMetadataService,
        { provide: TrackMetadataImportService, useValue: importer },
        { provide: TracksService, useValue: tracks },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(TrackMetadataService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('imports the Recording of the Track, then refreshes the pages of its Artists and Albums once it is completed', async () => {
    await service.run({ trackId: 'track-1' }, true);

    expect(importer.importMetadata).toHaveBeenCalledWith(
      'track-1',
      'recording-1',
    );
    expect(revalidation.revalidate).toHaveBeenCalledWith([
      'artist:artist-1',
      'artist:artist-1:tracks',
      'album:album-1',
      'album:album-1:tracks',
    ]);
  });

  it('leaves the pages alone while the Track is still processing, since they do not show it yet', async () => {
    tracks.isTrackCompleted.mockResolvedValue(false);

    await service.run({ trackId: 'track-1' }, true);

    expect(importer.importMetadata).toHaveBeenCalled();
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });

  it('refreshes nothing when the import linked nothing', async () => {
    importer.importMetadata.mockResolvedValue({ artistIds: [], albumIds: [] });

    await service.run({ trackId: 'track-1' }, true);

    expect(tracks.isTrackCompleted).not.toHaveBeenCalled();
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });

  it('imports nothing for a Track that no longer exists', async () => {
    tracks.findRecordingMbid.mockResolvedValue(undefined);

    await service.run({ trackId: 'track-1' }, true);

    expect(importer.importMetadata).not.toHaveBeenCalled();
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });

  it('throws a failure that is not on the last attempt, so BullMQ retries the import', async () => {
    importer.importMetadata.mockRejectedValue(new Error('catalog is down'));

    await expect(service.run({ trackId: 'track-1' }, false)).rejects.toThrow(
      'catalog is down',
    );
  });

  it('logs a failure on the last attempt and resolves, leaving the Track as it is', async () => {
    importer.importMetadata.mockRejectedValue(new Error('catalog is down'));

    await expect(
      service.run({ trackId: 'track-1' }, true),
    ).resolves.toBeUndefined();
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
});
