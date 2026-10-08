import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTrackBody } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { TrackPipeline } from './track-pipeline.service.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequestLauncher } from './track-request-launcher.service.js';

const requests = { requestTrack: vi.fn() };
const pipeline = { start: vi.fn() };

const body: CreateTrackBody = { recordingMbid: testMbid(1), locale: 'en' };

describe('TrackRequestLauncher', () => {
  let launcher: TrackRequestLauncher;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackRequestLauncher,
        { provide: TrackRequestService, useValue: requests },
        { provide: TrackPipeline, useValue: pipeline },
      ],
    }).compile();
    launcher = moduleRef.get(TrackRequestLauncher);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('starts the Processing of a Track the request created', async () => {
    requests.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: true,
    });

    await expect(launcher.requestTrack('user-1', body)).resolves.toEqual({
      trackId: 'track-1',
      created: true,
    });

    expect(requests.requestTrack).toHaveBeenCalledWith('user-1', body);
    expect(pipeline.start).toHaveBeenCalledWith('track-1');
  });

  it('starts nothing for a Recording that already has a Track', async () => {
    requests.requestTrack.mockResolvedValue({
      trackId: 'track-1',
      created: false,
    });

    await expect(launcher.requestTrack('user-1', body)).resolves.toEqual({
      trackId: 'track-1',
      created: false,
    });

    expect(pipeline.start).not.toHaveBeenCalled();
  });
});
