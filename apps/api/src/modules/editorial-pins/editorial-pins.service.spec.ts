import { Test, type TestingModule } from '@nestjs/testing';
import type {
  CreateEditorialPinBody,
  EditorialPinActor,
  UpdateEditorialPinBody,
} from '@notefinder/contracts';
import { fakeTransactionalDatabase } from '../../../test/utils/fake-transactional-db.js';
import { encodeTupleCursor } from '../../common/cursor/tuple-cursor.js';
import { AppException } from '../../common/errors/app-exception.js';
import { DATABASE, DATABASE_POOL } from '../../database/database.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EditorialPinScheduleService } from './editorial-pin-schedule.service.js';
import type { EditorialPinRecord } from './editorial-pins.repository.js';
import { EditorialPinsRepository } from './editorial-pins.repository.js';
import { EditorialPinsService } from './editorial-pins.service.js';

const repository = {
  findById: vi.fn(),
  findPage: vi.fn(),
  findHistoryPage: vi.fn(),
  findLive: vi.fn(),
  findCompletedTracks: vi.fn(),
  insertPin: vi.fn(),
  updatePin: vi.fn(),
  deletePin: vi.fn(),
  insertHistory: vi.fn(),
};
const schedule = {
  invalidateNow: vi.fn(),
  scheduleEdges: vi.fn(),
};

const ADMIN: EditorialPinActor = { id: 'admin-1', name: 'Ada Admin' };
const CREATED_AT = new Date('2026-10-01T10:00:00.000Z');

const createBody = (
  overrides: Partial<CreateEditorialPinBody> = {},
): CreateEditorialPinBody => ({
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds: ['t1', 't2'] },
  position: 2,
  titles: { en: 'Festive', 'pt-BR': 'Festivo' },
  ...overrides,
});

/** A stored pin, as the repository returns it (its Tracks in order). */
const storedPin = (
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
  titles: { en: 'Festive', 'pt-BR': 'Festivo' },
  sponsored: false,
  trackIds: ['t1', 't2'],
  createdBy: ADMIN,
  updatedBy: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const coveredTracks = (...ids: string[]) =>
  ids.map((id) => ({ id, coverUrl: `https://cdn.example/${id}.webp` }));

/** A history row, as the repository returns it. */
const historyEntry = (id: string, createdAt: Date) => ({
  id,
  pinId: 'pin-1',
  action: 'UPDATED' as const,
  changedFields: ['sponsored'],
  actor: ADMIN,
  state: storedPin(),
  createdAt,
});

describe('EditorialPinsService', () => {
  let service: EditorialPinsService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    repository.findCompletedTracks.mockResolvedValue(coveredTracks('t1', 't2'));
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

  describe('create', () => {
    it('refuses a Track that has not completed its Processing', async () => {
      repository.findCompletedTracks.mockResolvedValue(coveredTracks('t1'));

      const error = await service
        .create(createBody(), ADMIN)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppException);
      expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(repository.insertPin).not.toHaveBeenCalled();
    });

    it('refuses a hero whose Track has no cover', async () => {
      repository.findCompletedTracks.mockResolvedValue([
        { id: 't1', coverUrl: null },
      ]);

      const error = await service
        .create(
          createBody({
            kind: 'hero',
            layout: 'hero',
            source: { type: 'tracks', trackIds: ['t1'] },
          }),
          ADMIN,
        )
        .catch((e: unknown) => e);

      expect(error).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { issues: [{ trackId: 't1' }] },
      });
      expect(repository.insertPin).not.toHaveBeenCalled();
    });

    it('stores the pin with its defaults and records the creation in the history', async () => {
      repository.findById.mockResolvedValue(storedPin());

      const pin = await service.create(createBody(), ADMIN);

      expect(repository.insertPin).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'row',
          priority: 0,
          audience: 'everyone',
          locale: null,
          startsAt: null,
          endsAt: null,
          sponsored: false,
          trackIds: ['t1', 't2'],
        }),
        ADMIN.id,
      );
      expect(repository.insertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          pinId: 'pin-1',
          action: 'CREATED',
          actorId: ADMIN.id,
          changedFields: expect.arrayContaining(['sponsored', 'source']),
        }),
      );
      expect(pin).toMatchObject({
        id: 'pin-1',
        sponsored: false,
        createdBy: ADMIN,
        createdAt: CREATED_AT.toISOString(),
      });
    });

    it('revalidates every locale now for a pin that serves them all', async () => {
      repository.findById.mockResolvedValue(storedPin());

      await service.create(createBody(), ADMIN);

      expect(schedule.invalidateNow).toHaveBeenCalledWith(['en', 'pt-BR']);
      expect(schedule.scheduleEdges).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pin-1' }),
      );
    });

    it('revalidates only the locale of a locale-limited pin', async () => {
      repository.findById.mockResolvedValue(storedPin({ locale: 'pt-BR' }));

      await service.create(
        createBody({ locale: 'pt-BR', sponsored: true }),
        ADMIN,
      );

      expect(schedule.invalidateNow).toHaveBeenCalledWith(['pt-BR']);
      expect(repository.insertPin).toHaveBeenCalledWith(
        expect.objectContaining({ sponsored: true, locale: 'pt-BR' }),
        ADMIN.id,
      );
    });
  });

  describe('get and list', () => {
    it('answers NOT_FOUND for an unknown pin', async () => {
      repository.findById.mockResolvedValue(undefined);

      const error = await service.get('nope').catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns a page with the cursor of the next one while rows remain', async () => {
      const older = storedPin({
        id: 'pin-2',
        createdAt: new Date('2026-09-30T10:00:00.000Z'),
      });
      repository.findPage.mockResolvedValue([storedPin(), older]);

      const page = await service.list({ limit: 1 });

      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({ id: 'pin-1' });
      expect(page.nextCursor).toBe(
        encodeTupleCursor([CREATED_AT.toISOString(), 'pin-1']),
      );
    });

    it('ends the listing when the page is the last one', async () => {
      repository.findPage.mockResolvedValue([storedPin()]);

      const page = await service.list({ limit: 20 });

      expect(page.nextCursor).toBeNull();
    });

    it('refuses a cursor it did not issue', async () => {
      const error = await service
        .list({ cursor: 'not-a-cursor', limit: 20 })
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(repository.findPage).not.toHaveBeenCalled();
    });

    it('pages the history of a pin, with the admin who made each change', async () => {
      repository.findHistoryPage.mockResolvedValue([
        {
          id: 'h-1',
          pinId: 'pin-1',
          action: 'UPDATED',
          changedFields: ['sponsored'],
          actor: ADMIN,
          state: storedPin(),
          createdAt: CREATED_AT,
        },
      ]);

      const page = await service.history('pin-1', { limit: 20 });

      expect(page).toEqual({
        items: [
          expect.objectContaining({
            id: 'h-1',
            action: 'UPDATED',
            changedFields: ['sponsored'],
            actor: ADMIN,
            createdAt: CREATED_AT.toISOString(),
          }),
        ],
        nextCursor: null,
      });
    });
  });

  describe('update', () => {
    it('changes nothing and writes nothing when the patch matches the pin', async () => {
      repository.findById.mockResolvedValue(storedPin());

      await service.update('pin-1', { sponsored: false }, ADMIN);

      expect(repository.updatePin).not.toHaveBeenCalled();
      expect(repository.insertHistory).not.toHaveBeenCalled();
      expect(schedule.invalidateNow).not.toHaveBeenCalled();
    });

    it('records a sponsored toggle with the admin who did it and revalidates at once', async () => {
      const before = storedPin();
      const after = storedPin({ sponsored: true, updatedBy: ADMIN });
      repository.findById
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);

      const patch: UpdateEditorialPinBody = { sponsored: true };
      const pin = await service.update('pin-1', patch, ADMIN);

      expect(repository.updatePin).toHaveBeenCalledWith(
        'pin-1',
        expect.objectContaining({ sponsored: true }),
        ADMIN.id,
      );
      expect(repository.insertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          pinId: 'pin-1',
          action: 'UPDATED',
          changedFields: ['sponsored'],
          actorId: ADMIN.id,
          state: expect.objectContaining({ sponsored: true }),
        }),
      );
      expect(schedule.invalidateNow).toHaveBeenCalledWith(['en', 'pt-BR']);
      expect(pin.sponsored).toBe(true);
    });

    it('checks the Tracks again when the source changes', async () => {
      repository.findById.mockResolvedValue(storedPin());
      repository.findCompletedTracks.mockResolvedValue(coveredTracks('t1'));

      const error = await service
        .update(
          'pin-1',
          { source: { type: 'tracks', trackIds: ['t1', 't9'] } },
          ADMIN,
        )
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(repository.updatePin).not.toHaveBeenCalled();
    });

    it('does not refuse an edit that leaves the Tracks alone, even when one became ineligible', async () => {
      repository.findById
        .mockResolvedValueOnce(storedPin())
        .mockResolvedValueOnce(storedPin({ priority: 3 }));
      repository.findCompletedTracks.mockResolvedValue([]);

      await service.update('pin-1', { priority: 3 }, ADMIN);

      expect(repository.findCompletedTracks).not.toHaveBeenCalled();
      expect(repository.updatePin).toHaveBeenCalled();
    });

    it('refuses a merged pin whose window ends before it starts', async () => {
      repository.findById.mockResolvedValue(storedPin());

      await expect(
        service.update(
          'pin-1',
          {
            startsAt: '2026-10-10T00:00:00.000Z',
            endsAt: '2026-10-09T00:00:00.000Z',
          },
          ADMIN,
        ),
      ).rejects.toThrow();
      expect(repository.updatePin).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for an unknown pin', async () => {
      repository.findById.mockResolvedValue(undefined);

      const error = await service
        .update('nope', { priority: 1 }, ADMIN)
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('remove', () => {
    it('keeps a DELETED entry in the history, removes the pin and revalidates its locales', async () => {
      repository.findById.mockResolvedValue(storedPin({ locale: 'en' }));

      await service.remove('pin-1', ADMIN);

      expect(repository.insertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          pinId: 'pin-1',
          action: 'DELETED',
          changedFields: [],
          actorId: ADMIN.id,
        }),
      );
      expect(repository.deletePin).toHaveBeenCalledWith('pin-1');
      expect(schedule.invalidateNow).toHaveBeenCalledWith(['en']);
    });

    it('answers NOT_FOUND for an unknown pin', async () => {
      repository.findById.mockResolvedValue(undefined);

      const error = await service
        .remove('nope', ADMIN)
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'NOT_FOUND' });
      expect(repository.deletePin).not.toHaveBeenCalled();
    });
  });

  describe('paging, eligibility and locales in detail', () => {
    it('answers the cursor of the last shown history entry when more follow', async () => {
      const older = new Date('2026-09-30T10:00:00.000Z');
      repository.findHistoryPage.mockResolvedValue([
        historyEntry('h-1', CREATED_AT),
        historyEntry('h-2', older),
      ]);

      const page = await service.history('pin-1', { limit: 1 });

      expect(page.items.map((item) => item.id)).toEqual(['h-1']);
      expect(page.nextCursor).toBe(
        encodeTupleCursor([CREATED_AT.toISOString(), 'h-1']),
      );
    });

    it('passes the decoded cursor of the page to the repository', async () => {
      repository.findPage.mockResolvedValue([]);
      const cursor = encodeTupleCursor([CREATED_AT.toISOString(), 'pin-9']);

      await service.list({ cursor, limit: 20 });

      expect(repository.findPage).toHaveBeenCalledWith({
        after: { createdAt: CREATED_AT, id: 'pin-9' },
        limit: 20,
      });
    });

    it('refuses a cursor whose time is not a date', async () => {
      const cursor = encodeTupleCursor(['not-a-date', 'pin-9']);

      const error = await service
        .list({ cursor, limit: 20 })
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(repository.findPage).not.toHaveBeenCalled();
    });

    it('names the Track that cannot appear, with the reason', async () => {
      repository.findCompletedTracks.mockResolvedValue(coveredTracks('t1'));

      const error = await service
        .create(createBody(), ADMIN)
        .catch((e: unknown) => e);

      expect(error).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: {
          location: 'custom',
          issues: [
            {
              trackId: 't2',
              message:
                'The Track has not completed its Processing or does not exist',
            },
          ],
        },
      });
    });

    it('revalidates both locales when a pin moves from every locale to one', async () => {
      repository.findById
        .mockResolvedValueOnce(storedPin())
        .mockResolvedValueOnce(storedPin({ locale: 'pt-BR' }));

      await service.update('pin-1', { locale: 'pt-BR' }, ADMIN);

      expect(schedule.invalidateNow).toHaveBeenCalledWith(['en', 'pt-BR']);
      expect(repository.findCompletedTracks).not.toHaveBeenCalled();
    });

    it('reads the live pins at the current time when none is given', async () => {
      repository.findLive.mockResolvedValue([]);
      const before = Date.now();

      await service.findLivePins({ locale: 'en', signedIn: false });

      const [args] = repository.findLive.mock.calls[0] as [{ now: Date }];
      expect(args.now.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('findLivePins', () => {
    it('reads the pins live for the viewer, in the API shape', async () => {
      repository.findLive.mockResolvedValue([storedPin()]);
      const now = new Date('2026-10-20T12:00:00.000Z');

      const pins = await service.findLivePins({
        locale: 'en',
        signedIn: true,
        now,
      });

      expect(repository.findLive).toHaveBeenCalledWith({
        locale: 'en',
        signedIn: true,
        now,
      });
      expect(pins).toEqual([
        expect.objectContaining({
          id: 'pin-1',
          source: { type: 'tracks', trackIds: ['t1', 't2'] },
          createdAt: CREATED_AT.toISOString(),
        }),
      ]);
    });
  });
});
