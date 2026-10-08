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

// `createTrack` is `@Transactional()`: the database module runs it on a
// stand-in transaction client, so the write path is exercised without a
// database.
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
const requestOf = (mbid: string = testMbid(1)): CreateTrackBody => ({
  recordingMbid: mbid,
  locale: 'pt-BR',
});

/** The Track ids the lookup finds by Recording MBID. */
const knownTracks = (known: Record<string, string>) =>
  tracks.findTrackIdsByRecordingMbids.mockImplementation(
    async (mbids: string[]) =>
      new Map(
        mbids.flatMap((mbid) =>
          known[mbid] === undefined ? [] : [[mbid, known[mbid]] as const],
        ),
      ),
  );

describe('TrackRequestService', () => {
  let service: TrackRequestService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracks.findTrackIdsByRecordingMbids.mockResolvedValue(new Map());
    tracks.insertTrack.mockResolvedValue('track-new');
    processings.insertQueuedProcessing.mockResolvedValue('processing-1');
    processings.findOrInsertContributor.mockResolvedValue('contributor-1');
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

  it('answers with the existing Track and asks the catalog nothing', async () => {
    knownTracks({ [testMbid(1)]: 'track-existing' });

    await expect(service.requestTrack(USER_ID, requestOf())).resolves.toEqual({
      trackId: 'track-existing',
      created: false,
    });
    expect(catalog.getRecording).not.toHaveBeenCalled();
    expect(tracks.insertTrack).not.toHaveBeenCalled();
  });

  it('creates the Track from the catalog Recording with its first Processing and CREATE Contribution', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingFixture(),
    });

    await expect(service.requestTrack(USER_ID, requestOf())).resolves.toEqual({
      trackId: 'track-new',
      created: true,
    });
    expect(tracks.insertTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingMbid: testMbid(1),
        title: 'Bohemian Rhapsody',
        genres: ['rock'],
      }),
    );
    expect(tracks.insertTrackDetails).toHaveBeenCalledWith(
      'track-new',
      expect.objectContaining({
        tags: [{ name: 'classic rock', count: 4 }],
      }),
    );
    expect(processings.insertQueuedProcessing).toHaveBeenCalledWith(
      'track-new',
    );
    expect(processings.findOrInsertContributor).toHaveBeenCalledWith(
      'track-new',
      USER_ID,
    );
    expect(processings.insertContribution).toHaveBeenCalledWith({
      contributorId: 'contributor-1',
      kind: 'CREATE',
      processingId: 'processing-1',
    });
    expect(users.setLocale).toHaveBeenCalledWith(USER_ID, 'pt-BR');
  });

  it('follows a merged Recording to the MBID it was merged into', async () => {
    const merged = testMbid(2);
    catalog.getRecording.mockImplementation(async (mbid: string) =>
      mbid === testMbid(1)
        ? { status: 'moved', newMbid: merged }
        : {
            status: 'found',
            recording: recordingFixture({ mbid: merged }),
          },
    );

    await expect(service.requestTrack(USER_ID, requestOf())).resolves.toEqual({
      trackId: 'track-new',
      created: true,
    });
    expect(tracks.insertTrack).toHaveBeenCalledWith(
      expect.objectContaining({ recordingMbid: merged }),
    );
  });

  it('answers with the Track of the MBID a merged Recording moved to, writing nothing', async () => {
    knownTracks({ [testMbid(2)]: 'track-merged' });
    catalog.getRecording.mockImplementation(async (mbid: string) =>
      mbid === testMbid(1)
        ? { status: 'moved', newMbid: testMbid(2) }
        : {
            status: 'found',
            recording: recordingFixture({ mbid: testMbid(2) }),
          },
    );

    await expect(service.requestTrack(USER_ID, requestOf())).resolves.toEqual({
      trackId: 'track-merged',
      created: false,
    });
    expect(tracks.insertTrack).not.toHaveBeenCalled();
    expect(users.setLocale).not.toHaveBeenCalled();
  });

  it('refuses a Recording the catalog does not know with NOT_FOUND', async () => {
    catalog.getRecording.mockResolvedValue({ status: 'not-found' });

    await expect(
      service.requestTrack(USER_ID, requestOf()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tracks.insertTrack).not.toHaveBeenCalled();
  });

  it('gives up with NOT_FOUND when a Recording has been merged too many times', async () => {
    catalog.getRecording.mockImplementation(async (mbid: string) => ({
      status: 'moved',
      newMbid: mbid === testMbid(1) ? testMbid(2) : testMbid(1),
    }));

    await expect(
      service.requestTrack(USER_ID, requestOf()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tracks.insertTrack).not.toHaveBeenCalled();
  });

  it('lets the request that lost a race answer with the winner Track and write nothing', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingFixture(),
    });
    tracks.insertTrack.mockResolvedValue(undefined);
    // The lookups before the write miss; the one inside the transaction, after
    // the insert lost the race, finds the winner's Track.
    tracks.findTrackIdsByRecordingMbids
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map([[testMbid(1), 'track-winner']]));

    await expect(service.requestTrack(USER_ID, requestOf())).resolves.toEqual({
      trackId: 'track-winner',
      created: false,
    });
    expect(tracks.insertTrackDetails).not.toHaveBeenCalled();
    expect(processings.insertQueuedProcessing).not.toHaveBeenCalled();
    expect(processings.insertContribution).not.toHaveBeenCalled();
    expect(users.setLocale).not.toHaveBeenCalled();
  });

  it('fails with INTERNAL_ERROR when the winner of a race has vanished', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingFixture(),
    });
    tracks.insertTrack.mockResolvedValue(undefined);

    await expect(
      service.requestTrack(USER_ID, requestOf()),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
