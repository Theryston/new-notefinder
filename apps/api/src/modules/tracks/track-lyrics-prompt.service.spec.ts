import { Test, type TestingModule } from '@nestjs/testing';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TrackLyricsPromptService } from './track-lyrics-prompt.service.js';
import { TracksRepository } from './tracks.repository.js';

// The Lyrics that guide a transcription come from the Music catalog's Recording
// of the Track. The catalog and the Track's row are fakes.

const RECORDING_MBID = '6f16b2a2-0a9e-4a5e-9b0f-3d1f5f0a7c11';

describe('TrackLyricsPromptService', () => {
  const tracks = { findRecordingMbid: vi.fn() };
  const catalog = { getRecording: vi.fn() };
  let service: TrackLyricsPromptService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findRecordingMbid.mockResolvedValue(RECORDING_MBID);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackLyricsPromptService,
        { provide: TracksRepository, useValue: tracks },
        { provide: MusicCatalogClient, useValue: catalog },
      ],
    }).compile();
    service = moduleRef.get(TrackLyricsPromptService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it("answers the plain Lyrics the catalog has for the Track's Recording", async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: { lyrics: { plain: 'Is this the real life?', synced: null } },
    });

    await expect(service.lyricsOf('track-1')).resolves.toBe(
      'Is this the real life?',
    );
    expect(tracks.findRecordingMbid).toHaveBeenCalledWith('track-1');
    expect(catalog.getRecording).toHaveBeenCalledWith(RECORDING_MBID);
  });

  it('answers null when the Recording has no plain Lyrics', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: { lyrics: { plain: null, synced: null } },
    });

    await expect(service.lyricsOf('track-1')).resolves.toBeNull();
  });

  it('answers null when the catalog does not know the Recording', async () => {
    catalog.getRecording.mockResolvedValue({ status: 'not-found' });

    await expect(service.lyricsOf('track-1')).resolves.toBeNull();
  });

  it("answers null for a Recording the catalog merged into another, whose Lyrics are not this one's", async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'moved',
      newMbid: '7a27c3b3-1b0f-4b6f-8c1e-4e2f6a8d9d22',
    });

    await expect(service.lyricsOf('track-1')).resolves.toBeNull();
  });

  it('fails when the catalog cannot be asked, so the step is retried', async () => {
    catalog.getRecording.mockRejectedValue(new Error('catalog is down'));

    await expect(service.lyricsOf('track-1')).rejects.toThrow(
      'catalog is down',
    );
  });

  it('fails when the Track disappeared during its Processing', async () => {
    tracks.findRecordingMbid.mockResolvedValue(undefined);

    await expect(service.lyricsOf('track-1')).rejects.toThrow(
      'Track track-1 disappeared during its Processing',
    );
    expect(catalog.getRecording).not.toHaveBeenCalled();
  });
});
