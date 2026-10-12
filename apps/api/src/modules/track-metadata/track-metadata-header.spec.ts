import { Test } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { TrackMetadataService } from './track-metadata.service.js';
import { TrackMetadataImportService } from './track-metadata-import.service.js';

// The Track page caches its header (with the Artist links) under the Track's
// tag, so linking Artists after completion must revalidate that tag too.

const importer = { importMetadata: vi.fn() };
const tracks = { findRecordingMbid: vi.fn(), isTrackCompleted: vi.fn() };
const revalidation = { revalidate: vi.fn() };

describe('TrackMetadataService, Track header', () => {
  let service: TrackMetadataService;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findRecordingMbid.mockResolvedValue('recording-1');
    tracks.isTrackCompleted.mockResolvedValue(true);
    importer.importMetadata.mockResolvedValue({
      artistIds: ['artist-1'],
      albumIds: [],
    });
    revalidation.revalidate.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackMetadataService,
        { provide: TrackMetadataImportService, useValue: importer },
        { provide: TracksService, useValue: tracks },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(TrackMetadataService);
  });

  it('revalidates the Track page once its Artists are linked', async () => {
    await service.run({ trackId: 'track-1' }, true);

    expect(revalidation.revalidate).toHaveBeenCalledWith(['track:track-1']);
  });

  it('leaves the Track page alone while the Track is still processing', async () => {
    tracks.isTrackCompleted.mockResolvedValue(false);

    await service.run({ trackId: 'track-1' }, true);

    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
});
