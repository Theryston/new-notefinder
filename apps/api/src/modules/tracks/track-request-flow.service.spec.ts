import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTrackBody } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { TrackMetadataService } from './track-metadata.service.js';
import { TrackRequestFlowService } from './track-request-flow.service.js';
import { TrackRequestLauncherService } from './track-request-launcher.service.js';
import type { TrackRequester } from './track-requester.service.js';

// A request starts the import of a Track it creates, and nothing for one that
// already exists. The launcher (the Processing) and the import are fakes.

const launcher = { requestTrack: vi.fn() };
const metadata = { enqueueImport: vi.fn() };

const requester: TrackRequester = { id: 'user-1', role: 'USER' };
const body: CreateTrackBody = { recordingMbid: testMbid(1), locale: 'en' };

describe('TrackRequestFlowService', () => {
  let flow: TrackRequestFlowService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    metadata.enqueueImport.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackRequestFlowService,
        { provide: TrackRequestLauncherService, useValue: launcher },
        { provide: TrackMetadataService, useValue: metadata },
      ],
    }).compile();
    flow = moduleRef.get(TrackRequestFlowService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('imports the metadata of a Track the request created', async () => {
    launcher.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: true,
    });

    await expect(flow.requestTrack(requester, body)).resolves.toEqual({
      trackId: 'track-1',
      created: true,
    });

    expect(launcher.requestTrack).toHaveBeenCalledWith(requester, body);
    expect(metadata.enqueueImport).toHaveBeenCalledWith('track-1');
  });

  it('answers an existing Track without importing its metadata again', async () => {
    launcher.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: false,
    });

    await expect(flow.requestTrack(requester, body)).resolves.toEqual({
      trackId: 'track-1',
      created: false,
    });

    expect(metadata.enqueueImport).not.toHaveBeenCalled();
  });

  it('fails the request, and imports nothing, when the Processing cannot start', async () => {
    launcher.requestTrack.mockRejectedValue(new Error('redis is down'));

    await expect(flow.requestTrack(requester, body)).rejects.toThrow(
      'redis is down',
    );
    expect(metadata.enqueueImport).not.toHaveBeenCalled();
  });
});
