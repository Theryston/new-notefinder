import { Test, type TestingModule } from '@nestjs/testing';
import type { CreateTrackBody } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { recordingFixture } from '../../../test/utils/recording-fixtures.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { UsersService } from '../users/users.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackRequestService } from './track-request.service.js';
import { TracksRepository } from './tracks.repository.js';

// The admission check (the User's limits) runs inside the write transaction:
// these specs pin when it runs and what a refusal leaves behind. The
// transaction is a stand-in, as in track-request.service.spec.ts.
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
const users = { setLocale: vi.fn() };

const USER_ID = 'user-1';
const body: CreateTrackBody = { recordingMbid: testMbid(1), locale: 'en' };

describe('TrackRequestService admission', () => {
  let service: TrackRequestService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findTrackIdsByRecordingMbids.mockResolvedValue(new Map());
    tracks.insertTrack.mockResolvedValue('track-new');
    processings.insertQueuedProcessing.mockResolvedValue('processing-1');
    processings.findOrInsertContributor.mockResolvedValue('contributor-1');
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
        { provide: UsersService, useValue: users },
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

  it('runs the admission before the Track is written', async () => {
    const admit = vi.fn(() => Promise.resolve());

    await service.requestTrack(USER_ID, body, admit);

    expect(admit).toHaveBeenCalledTimes(1);
    const admittedFirst = admit.mock.invocationCallOrder[0] ?? Infinity;
    const insertedAt = tracks.insertTrack.mock.invocationCallOrder[0] ?? 0;
    expect(admittedFirst).toBeLessThan(insertedAt);
  });

  it('writes nothing when the admission refuses the request', async () => {
    const refusal = new Error('limit reached');

    await expect(
      service.requestTrack(USER_ID, body, () => Promise.reject(refusal)),
    ).rejects.toBe(refusal);

    expect(tracks.insertTrack).not.toHaveBeenCalled();
    expect(processings.insertQueuedProcessing).not.toHaveBeenCalled();
    expect(processings.insertContribution).not.toHaveBeenCalled();
    expect(users.setLocale).not.toHaveBeenCalled();
  });

  it('never asks the admission about a Recording that already has a Track', async () => {
    tracks.findTrackIdsByRecordingMbids.mockResolvedValue(
      new Map([[testMbid(1), 'track-existing']]),
    );
    const admit = vi.fn(() => Promise.resolve());

    await expect(service.requestTrack(USER_ID, body, admit)).resolves.toEqual({
      trackId: 'track-existing',
      created: false,
    });
    expect(admit).not.toHaveBeenCalled();
  });
});
