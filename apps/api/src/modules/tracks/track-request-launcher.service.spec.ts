import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTrackBody } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { TrackPipelineService } from './track-pipeline.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequestLauncherService } from './track-request-launcher.service.js';
import type { TrackRequester } from './track-requester.service.js';

const requests = { requestTrack: vi.fn() };
const pipeline = { startIfQueued: vi.fn() };

const requester: TrackRequester = { id: 'user-1', role: 'USER' };
const body: CreateTrackBody = { recordingMbid: testMbid(1), locale: 'en' };

describe('TrackRequestLauncherService', () => {
  let launcher: TrackRequestLauncherService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    pipeline.startIfQueued.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackRequestLauncherService,
        { provide: TrackRequestService, useValue: requests },
        { provide: TrackPipelineService, useValue: pipeline },
      ],
    }).compile();
    launcher = moduleRef.get(TrackRequestLauncherService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('starts the Processing of a Track the request created', async () => {
    requests.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: true,
    });

    await expect(launcher.requestTrack(requester, body)).resolves.toEqual({
      trackId: 'track-1',
      created: true,
    });

    expect(requests.requestTrack).toHaveBeenCalledWith(requester, body);
    expect(pipeline.startIfQueued).toHaveBeenCalledWith('track-1');
  });

  it('answers an existing Track as it is, and asks the pipeline to start it only if still queued', async () => {
    requests.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: false,
    });

    await expect(launcher.requestTrack(requester, body)).resolves.toEqual({
      trackId: 'track-1',
      created: false,
    });

    expect(pipeline.startIfQueued).toHaveBeenCalledWith('track-1');
  });

  it('fails the request when the pipeline cannot be started, so the next request retries it', async () => {
    requests.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: true,
    });
    pipeline.startIfQueued.mockRejectedValue(new Error('redis is down'));

    await expect(launcher.requestTrack(requester, body)).rejects.toThrow(
      'redis is down',
    );
  });
});
