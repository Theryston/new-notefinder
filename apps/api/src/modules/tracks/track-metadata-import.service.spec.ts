import { Test, type TestingModule } from '@nestjs/testing';
import type { Recording, RecordingRelease } from '@notefinder/contracts';
import {
  artistFixture,
  queenAndBowieCredit,
  releaseGroupFixture,
} from '../../../test/utils/catalog-fixtures.js';
import { testMbid } from '../../../test/utils/factories.js';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { recordingFixture } from '../../../test/utils/recording-fixtures.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TrackAlbumCoverService } from './track-album-cover.service.js';
import { TrackMetadataRepository } from './track-metadata.repository.js';
import { TrackMetadataImportService } from './track-metadata-import.service.js';

// The import's decisions: which Artists and Albums a Recording links to, in
// which order, and what each write carries. The rows are fakes; the database
// writes themselves are covered by the e2e suite.

// `linkAlbum` is `@Transactional()`: the database module runs it on a stand-in
// transaction client, so the write path is exercised without a database.
const { db, pool } = fakeTransactionalDatabase();

const repository = {
  findRecordingMbid: vi.fn(),
  linkTrackArtists: vi.fn(),
  upsertArtist: vi.fn(),
  upsertAlbum: vi.fn(),
  setAlbumCoverUrl: vi.fn(),
  replaceAlbumArtists: vi.fn(),
  upsertAlbumDiscs: vi.fn(),
  upsertAlbumTrack: vi.fn(),
};
const catalog = {
  getRecording: vi.fn(),
  getReleaseGroup: vi.fn(),
  getArtist: vi.fn(),
};
const covers = { storeCover: vi.fn() };

const TRACK = 'track-1';
const QUEEN = testMbid(41);
const BOWIE = testMbid(42);
const GROUP = testMbid(40);
const RELEASE = testMbid(30);
/** The row each Artist is written as, keyed by MBID. */
const ARTIST_IDS: Record<string, string> = {
  [QUEEN]: 'artist-queen',
  [BOWIE]: 'artist-bowie',
};

/** A release of the Recording on one release group, at a place on it. */
const releaseOf = (
  overrides: Partial<RecordingRelease> = {},
): RecordingRelease => ({
  mbid: RELEASE,
  title: 'A Night at the Opera',
  releaseGroup: { mbid: GROUP, primaryType: 'Album' },
  status: 'Official',
  date: '1975-11-21',
  country: 'GB',
  mediumPosition: 1,
  trackPosition: 11,
  coverArtUrl: `https://coverartarchive.org/release/${RELEASE}/front-500`,
  ...overrides,
});

/** A Recording by Queen on one release group. */
const recordingOn = (releases: RecordingRelease[] = [releaseOf()]): Recording =>
  recordingFixture({
    mbid: testMbid(1),
    artistCredit: {
      name: 'Queen',
      artists: [
        { mbid: QUEEN, name: 'Queen', creditedName: 'Queen', joinPhrase: '' },
      ],
    },
    releases,
  });

/** The stand-in the repository answers an Album upsert with. */
const albumHeader = (hasCover: boolean) => ({
  id: 'album-1',
  hasCover,
});

describe('TrackMetadataImportService', () => {
  let importer: TrackMetadataImportService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    repository.findRecordingMbid.mockResolvedValue(testMbid(1));
    repository.upsertArtist.mockImplementation(
      async (artist: { mbid: string }) => ARTIST_IDS[artist.mbid],
    );
    repository.upsertAlbum.mockResolvedValue(albumHeader(false));
    covers.storeCover.mockResolvedValue(undefined);
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingOn(),
    });
    catalog.getReleaseGroup.mockResolvedValue({
      status: 'found',
      releaseGroup: releaseGroupFixture({ mbid: GROUP }),
    });
    catalog.getArtist.mockImplementation(async (mbid: string) => ({
      status: 'found',
      artist: artistFixture({
        mbid,
        name: mbid === BOWIE ? 'David Bowie' : 'Queen',
      }),
    }));
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        TrackMetadataImportService,
        { provide: TrackMetadataRepository, useValue: repository },
        { provide: MusicCatalogClient, useValue: catalog },
        { provide: TrackAlbumCoverService, useValue: covers },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    importer = moduleRef.get(TrackMetadataImportService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('upserts the credited Artist with its genres and links it to the Track', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingOn([]),
    });

    const links = await importer.importMetadata(TRACK);

    expect(catalog.getArtist).toHaveBeenCalledWith(QUEEN);
    expect(repository.upsertArtist).toHaveBeenCalledWith({
      mbid: QUEEN,
      name: 'Queen',
      genres: ['glam rock'],
    });
    expect(repository.linkTrackArtists).toHaveBeenCalledWith(TRACK, [
      'artist-queen',
    ]);
    expect(links).toEqual({ artistIds: ['artist-queen'], albumIds: [] });
  });

  it('writes the release group as an Album, with its artists in credit order', async () => {
    // Queen is credited first, so the order is not the one the IDs sort in.
    catalog.getReleaseGroup.mockResolvedValue({
      status: 'found',
      releaseGroup: releaseGroupFixture({
        mbid: GROUP,
        artistCredit: queenAndBowieCredit(),
      }),
    });

    const links = await importer.importMetadata(TRACK);

    expect(repository.upsertAlbum).toHaveBeenCalledWith({
      mbid: GROUP,
      title: 'A Night at the Opera',
      primaryType: 'Album',
      secondaryTypes: [],
      year: 1975,
      genres: ['rock'],
    });
    expect(repository.replaceAlbumArtists).toHaveBeenCalledWith('album-1', [
      'artist-queen',
      'artist-bowie',
    ]);
    expect(links.albumIds).toEqual(['album-1']);
  });

  it('places the Track on the Album from the representative release, with its discs', async () => {
    catalog.getReleaseGroup.mockResolvedValue({
      status: 'found',
      releaseGroup: releaseGroupFixture({
        mbid: GROUP,
        representativeRelease: {
          mbid: RELEASE,
          title: 'A Night at the Opera',
          media: [
            {
              position: 1,
              title: '',
              tracks: [{ position: 11, recordingMbid: testMbid(1) }],
            },
          ],
        },
      }),
    });

    await importer.importMetadata(TRACK);

    expect(repository.upsertAlbumDiscs).toHaveBeenCalledWith('album-1', [
      { position: 1, title: null },
    ]);
    expect(repository.upsertAlbumTrack).toHaveBeenCalledWith('album-1', TRACK, {
      discPosition: 1,
      trackPosition: 11,
    });
  });

  it('places the Track from its own release when the representative release lacks it', async () => {
    catalog.getReleaseGroup.mockResolvedValue({
      status: 'found',
      releaseGroup: releaseGroupFixture({
        mbid: GROUP,
        representativeRelease: {
          mbid: testMbid(31),
          title: 'Deluxe',
          media: [{ position: 1, title: 'Main', tracks: [] }],
        },
      }),
    });
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingOn([
        releaseOf({ mediumPosition: 2, trackPosition: 4 }),
      ]),
    });

    await importer.importMetadata(TRACK);

    expect(repository.upsertAlbumDiscs).toHaveBeenCalledWith('album-1', [
      { position: 1, title: 'Main' },
      { position: 2, title: null },
    ]);
    expect(repository.upsertAlbumTrack).toHaveBeenCalledWith('album-1', TRACK, {
      discPosition: 2,
      trackPosition: 4,
    });
  });

  it('stores the cover of an Album that has none, and records its URL', async () => {
    covers.storeCover.mockResolvedValue(
      'https://cdn.test/album-covers/album-1.webp',
    );

    await importer.importMetadata(TRACK);

    expect(covers.storeCover).toHaveBeenCalledWith(
      'album-1',
      expect.stringContaining(`release-group/${GROUP}`),
    );
    expect(repository.setAlbumCoverUrl).toHaveBeenCalledWith(
      'album-1',
      'https://cdn.test/album-covers/album-1.webp',
    );
  });

  it('keeps the cover an Album already has, without downloading it again', async () => {
    repository.upsertAlbum.mockResolvedValue(albumHeader(true));

    await importer.importMetadata(TRACK);

    expect(covers.storeCover).not.toHaveBeenCalled();
    expect(repository.setAlbumCoverUrl).not.toHaveBeenCalled();
  });

  it('leaves an Album with no cover in the archive without a cover URL', async () => {
    covers.storeCover.mockResolvedValue(undefined);

    await importer.importMetadata(TRACK);

    expect(repository.setAlbumCoverUrl).not.toHaveBeenCalled();
  });

  it('follows a release group the catalog merged into another', async () => {
    const merged = testMbid(44);
    catalog.getReleaseGroup
      .mockResolvedValueOnce({ status: 'moved', newMbid: merged })
      .mockResolvedValueOnce({
        status: 'found',
        releaseGroup: releaseGroupFixture({ mbid: merged }),
      });

    const links = await importer.importMetadata(TRACK);

    expect(catalog.getReleaseGroup).toHaveBeenLastCalledWith(merged);
    expect(repository.upsertAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ mbid: merged }),
    );
    expect(links.albumIds).toEqual(['album-1']);
  });

  it('leaves out a release group the catalog does not know', async () => {
    catalog.getReleaseGroup.mockResolvedValue({ status: 'not-found' });

    const links = await importer.importMetadata(TRACK);

    expect(repository.upsertAlbum).not.toHaveBeenCalled();
    expect(links.albumIds).toEqual([]);
  });

  it('leaves out a credited Artist the catalog does not know', async () => {
    catalog.getArtist.mockResolvedValue({ status: 'not-found' });

    const links = await importer.importMetadata(TRACK);

    expect(repository.linkTrackArtists).toHaveBeenCalledWith(TRACK, []);
    expect(links.artistIds).toEqual([]);
  });

  it('fetches an Artist once per run, however many credits name it', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'found',
      recording: recordingOn([
        releaseOf({ releaseGroup: { mbid: GROUP, primaryType: 'Album' } }),
        releaseOf({
          mbid: testMbid(33),
          releaseGroup: { mbid: testMbid(45), primaryType: 'Single' },
        }),
      ]),
    });
    catalog.getReleaseGroup.mockImplementation(async (mbid: string) => ({
      status: 'found',
      releaseGroup: releaseGroupFixture({ mbid }),
    }));

    await importer.importMetadata(TRACK);

    expect(catalog.getArtist).toHaveBeenCalledTimes(1);
    expect(repository.upsertAlbum).toHaveBeenCalledTimes(2);
  });

  it('answers nothing when the Track no longer exists', async () => {
    repository.findRecordingMbid.mockResolvedValue(undefined);

    await expect(importer.importMetadata(TRACK)).resolves.toEqual({
      artistIds: [],
      albumIds: [],
    });
    expect(catalog.getRecording).not.toHaveBeenCalled();
  });

  it('answers nothing when the catalog does not know the Recording', async () => {
    catalog.getRecording.mockResolvedValue({ status: 'not-found' });

    await expect(importer.importMetadata(TRACK)).resolves.toEqual({
      artistIds: [],
      albumIds: [],
    });
    expect(repository.upsertArtist).not.toHaveBeenCalled();
  });

  it('follows a Recording the catalog merged, once', async () => {
    catalog.getRecording
      .mockResolvedValueOnce({ status: 'moved', newMbid: testMbid(2) })
      .mockResolvedValueOnce({
        status: 'found',
        recording: recordingOn([]),
      });

    await importer.importMetadata(TRACK);

    expect(catalog.getRecording).toHaveBeenLastCalledWith(testMbid(2));
  });

  it('answers nothing for a Recording that moved twice', async () => {
    catalog.getRecording.mockResolvedValue({
      status: 'moved',
      newMbid: testMbid(2),
    });

    await expect(importer.importMetadata(TRACK)).resolves.toEqual({
      artistIds: [],
      albumIds: [],
    });
  });
});
