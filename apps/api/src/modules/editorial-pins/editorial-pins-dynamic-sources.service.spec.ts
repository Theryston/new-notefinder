import { Test, type TestingModule } from '@nestjs/testing';
import type {
  CreateEditorialPinBody,
  EditorialPinActor,
} from '@notefinder/contracts';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { AppException } from '../../common/errors/app-exception.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EditorialPinScheduleService } from './editorial-pin-schedule.service.js';
import type { EditorialPinRecord } from './editorial-pins.repository.js';
import { EditorialPinsRepository } from './editorial-pins.repository.js';
import { EditorialPinsService } from './editorial-pins.service.js';

const repository = {
  findById: vi.fn(),
  findCompletedTracks: vi.fn(),
  sourceExists: vi.fn(),
  findSourceTrackIds: vi.fn(),
  insertPin: vi.fn(),
  updatePin: vi.fn(),
  insertHistory: vi.fn(),
};
const schedule = {
  invalidateNow: vi.fn(),
  scheduleEdges: vi.fn(),
};

const ADMIN: EditorialPinActor = { id: 'admin-1', name: 'Ada Admin' };
const CREATED_AT = new Date('2026-10-01T10:00:00.000Z');

const genreBody = (
  overrides: Partial<CreateEditorialPinBody> = {},
): CreateEditorialPinBody => ({
  kind: 'row',
  layout: 'standard',
  source: { type: 'genre', genre: 'rock' },
  position: 2,
  titles: { en: 'Rock', 'pt-BR': 'Rock' },
  ...overrides,
});

/** A stored pin built from a dynamic source, as the repository returns it. */
const storedDynamicPin = (
  overrides: Partial<EditorialPinRecord> = {},
): EditorialPinRecord => ({
  id: 'pin-1',
  kind: 'row',
  layout: 'standard',
  position: 2,
  priority: 0,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Rock', 'pt-BR': 'Rock' },
  sponsored: false,
  trackIds: [],
  dynamicSource: { type: 'genre', genre: 'rock' },
  createdBy: ADMIN,
  updatedBy: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

describe('EditorialPinsService dynamic sources', () => {
  let service: EditorialPinsService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    repository.sourceExists.mockResolvedValue(true);
    repository.findSourceTrackIds.mockResolvedValue([
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
    ]);
    repository.insertPin.mockResolvedValue('pin-1');
    const { db, pool } = fakeTransactionalDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        EditorialPinsService,
        { provide: EditorialPinsRepository, useValue: repository },
        { provide: EditorialPinScheduleService, useValue: schedule },
      ],
    })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    service = moduleRef.get(EditorialPinsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a genre pin, storing the genre instead of a Track list', async () => {
    repository.findById.mockResolvedValue(storedDynamicPin());

    const pin = await service.create(genreBody(), ADMIN);

    expect(repository.insertPin).toHaveBeenCalledWith(
      expect.objectContaining({
        trackIds: [],
        dynamicSource: { type: 'genre', genre: 'rock' },
      }),
      ADMIN.id,
    );
    expect(repository.findSourceTrackIds).toHaveBeenCalledWith(
      { type: 'genre', genre: 'rock' },
      { requireCover: false, limit: 6 },
    );
    expect(pin).toMatchObject({
      source: { type: 'genre', genre: 'rock' },
    });
  });

  it('creates an artist pin once the Artist offers enough eligible Tracks', async () => {
    repository.findById.mockResolvedValue(
      storedDynamicPin({
        dynamicSource: { type: 'artist', artistId: 'artist-1' },
      }),
    );

    const pin = await service.create(
      genreBody({ source: { type: 'artist', artistId: 'artist-1' } }),
      ADMIN,
    );

    expect(repository.sourceExists).toHaveBeenCalledWith({
      type: 'artist',
      artistId: 'artist-1',
    });
    expect(pin).toMatchObject({
      source: { type: 'artist', artistId: 'artist-1' },
    });
  });

  it('creates an album pin once the Album offers enough eligible Tracks', async () => {
    repository.findById.mockResolvedValue(
      storedDynamicPin({
        dynamicSource: { type: 'album', albumId: 'album-1' },
      }),
    );

    const pin = await service.create(
      genreBody({ source: { type: 'album', albumId: 'album-1' } }),
      ADMIN,
    );

    expect(pin).toMatchObject({
      source: { type: 'album', albumId: 'album-1' },
    });
  });

  it('refuses a pin naming an Artist that does not exist', async () => {
    repository.sourceExists.mockResolvedValue(false);

    const error = await service
      .create(
        genreBody({ source: { type: 'artist', artistId: 'missing' } }),
        ADMIN,
      )
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { issues: [{ path: ['source'] }] },
    });
    expect(error).toBeInstanceOf(AppException);
    expect(repository.insertPin).not.toHaveBeenCalled();
  });

  it('refuses a genre with fewer eligible Tracks than a row needs', async () => {
    repository.findSourceTrackIds.mockResolvedValue(['t1', 't2', 't3']);

    const error = await service
      .create(genreBody(), ADMIN)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: {
        issues: [{ message: 'The genre has fewer than 6 eligible Tracks' }],
      },
    });
    expect(repository.insertPin).not.toHaveBeenCalled();
  });

  it('refuses a hero whose genre offers no Track with a cover', async () => {
    repository.findSourceTrackIds.mockResolvedValue([]);

    const error = await service
      .create(
        genreBody({
          kind: 'hero',
          layout: 'hero',
          position: 0,
          source: { type: 'genre', genre: 'rock' },
        }),
        ADMIN,
      )
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(repository.findSourceTrackIds).toHaveBeenCalledWith(
      { type: 'genre', genre: 'rock' },
      { requireCover: true, limit: 1 },
    );
    expect(repository.insertPin).not.toHaveBeenCalled();
  });

  it('revalidates the source when an update switches a tracks pin to a genre', async () => {
    repository.findById.mockResolvedValue(
      storedDynamicPin({
        trackIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
        dynamicSource: null,
      }),
    );
    repository.findSourceTrackIds.mockResolvedValue(['t1']);

    const error = await service
      .update('pin-1', { source: { type: 'genre', genre: 'rock' } }, ADMIN)
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(repository.updatePin).not.toHaveBeenCalled();
  });

  it('leaves the source alone when an update touches another field', async () => {
    repository.findById.mockResolvedValue(storedDynamicPin());

    await service.update('pin-1', { sponsored: true }, ADMIN);

    expect(repository.findSourceTrackIds).not.toHaveBeenCalled();
    expect(repository.sourceExists).not.toHaveBeenCalled();
    expect(repository.updatePin).toHaveBeenCalled();
  });
});
