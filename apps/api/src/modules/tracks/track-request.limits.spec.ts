import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTrackBody } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { recordingFixture } from '../../../test/utils/recording-fixtures.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackRequestService } from './track-request.service.js';
import { TrackRequesterService } from './track-requester.service.js';
import { TracksRepository } from './tracks.repository.js';

// The request checks the requester's limits before it writes a new Track, and
// only then. The limits themselves are unit-tested in
// track-requester.service.spec.ts; here the service only has to ask at the
// right moment. The transaction is a stand-in, as in track-request.service.spec.ts.
const tx = { name: 'tx' };
const db = {
  name: 'db',
  transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
    callback(tx),
  ),
};
const pool = { end: vi.fn(async () => {}) };

const tracks = {
  findTrackIdsByRecordingMbids: vi.fn(),
  insertTrack: vi.fn(),
  insertTrackDetails: vi.fn(),
};
const processings = {
  insertQueuedProcessing: vi.fn(),
  findOrInsertContributor: vi.fn(),
  insertContribution: vi.fn(),
};
const catalog = { getRecording: vi.fn() };
const requesters = { assertCanRequestTrack: vi.fn(), recordLocale: vi.fn() };

const REQUESTER = { id: 'user-1', role: 'USER' };
const body: CreateTrackBody = { recordingMbid: testMbid(1), locale: 'en' };

describe('TrackRequestService and the requester limits', () => {
  let service: TrackRequestService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findTrackIdsByRecordingMbids.mockResolvedValue(new Map());
    tracks.insertTrack.mockResolvedValue('track-new');
    processings.insertQueuedProcessing.mockResolvedValue('processing-1');
    processings.findOrInsertContributor.mockResolvedValue('contributor-1');
    requesters.assertCanRequestTrack.mockResolvedValue(undefined);
    requesters.recordLocale.mockResolvedValue(undefined);
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingFixture({ mbid: testMbid(1) }),
    });
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        TrackRequestService,
        { provide: TracksRepository, useValue: tracks },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: MusicCatalogClient, useValue: catalog },
        { provide: TrackRequesterService, useValue: requesters },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(TrackRequestService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('asks the limits about the requester before the Track is written', async () => {
    await service.requestTrack(REQUESTER, body);

    expect(requesters.assertCanRequestTrack).toHaveBeenCalledWith(REQUESTER);
    const checkedFirst =
      requesters.assertCanRequestTrack.mock.invocationCallOrder[0] ?? Infinity;
    const insertedAt = tracks.insertTrack.mock.invocationCallOrder[0] ?? 0;
    expect(checkedFirst).toBeLessThan(insertedAt);
  });

  it('writes nothing when the limits refuse the request', async () => {
    const refusal = new Error('limit reached');
    requesters.assertCanRequestTrack.mockRejectedValue(refusal);

    await expect(service.requestTrack(REQUESTER, body)).rejects.toBe(refusal);

    expect(tracks.insertTrack).not.toHaveBeenCalled();
    expect(processings.insertQueuedProcessing).not.toHaveBeenCalled();
    expect(processings.insertContribution).not.toHaveBeenCalled();
    expect(requesters.recordLocale).not.toHaveBeenCalled();
  });

  it('never asks the limits about a Recording that already has a Track', async () => {
    tracks.findTrackIdsByRecordingMbids.mockResolvedValue(
      new Map([[testMbid(1), 'track-existing']]),
    );

    await expect(service.requestTrack(REQUESTER, body)).resolves.toEqual({
      trackId: 'track-existing',
      created: false,
    });
    expect(requesters.assertCanRequestTrack).not.toHaveBeenCalled();
  });
});
