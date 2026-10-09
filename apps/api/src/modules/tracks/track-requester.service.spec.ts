import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { UsersService } from '../users/users.service.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackRequesterService } from './track-requester.service.js';

const repository = {
  lockRequester: vi.fn(),
  countActiveProcessings: vi.fn(),
  countNewTracksBetween: vi.fn(),
};
const users = { setLocale: vi.fn() };

const NOW = new Date('2026-10-08T12:00:00Z');
const USER = { id: 'user-1', role: 'USER' };

/** A service with the given env (only the limit keys matter here). */
const build = async (env: Record<string, number> = {}) => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      TrackRequesterService,
      { provide: ENV, useValue: env },
      { provide: TrackProcessingRepository, useValue: repository },
      { provide: UsersService, useValue: users },
    ],
  }).compile();
  return moduleRef.get(TrackRequesterService);
};

describe('TrackRequesterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.lockRequester.mockResolvedValue(undefined);
    repository.countActiveProcessings.mockResolvedValue(0);
    repository.countNewTracksBetween.mockResolvedValue(0);
    users.setLocale.mockResolvedValue(undefined);
  });

  it('lets an ADMIN request past both limits without locking or counting', async () => {
    repository.countActiveProcessings.mockResolvedValue(99);
    repository.countNewTracksBetween.mockResolvedValue(99);
    const service = await build();

    await expect(
      service.assertCanRequestTrack({ id: 'admin-1', role: 'ADMIN' }, NOW),
    ).resolves.toBeUndefined();
    expect(repository.lockRequester).not.toHaveBeenCalled();
    expect(repository.countActiveProcessings).not.toHaveBeenCalled();
  });

  it('locks the User before counting, so the count sees the requests that ran before', async () => {
    const service = await build();

    await service.assertCanRequestTrack(USER, NOW);

    expect(repository.lockRequester).toHaveBeenCalledWith('user-1');
    const lockedFirst =
      repository.lockRequester.mock.invocationCallOrder[0] ?? Infinity;
    const countedFirst =
      repository.countActiveProcessings.mock.invocationCallOrder[0] ?? 0;
    expect(lockedFirst).toBeLessThan(countedFirst);
  });

  it('counts the new Tracks of the UTC day of the request', async () => {
    const service = await build();

    await service.assertCanRequestTrack(USER, NOW);

    expect(repository.countNewTracksBetween).toHaveBeenCalledWith(
      'user-1',
      new Date('2026-10-08T00:00:00Z'),
      new Date('2026-10-09T00:00:00Z'),
    );
  });

  it('refuses with PROCESSING_LIMIT_REACHED and the active limit when it is full', async () => {
    repository.countActiveProcessings.mockResolvedValue(3);
    const service = await build();

    await expect(
      service.assertCanRequestTrack(USER, NOW),
    ).rejects.toMatchObject({
      code: 'PROCESSING_LIMIT_REACHED',
      details: { limit: 'ACTIVE_PROCESSINGS', max: 3 },
    });
  });

  it('refuses with the daily limit of the env once the day is used up', async () => {
    repository.countNewTracksBetween.mockResolvedValue(5);
    const service = await build({ PROCESSING_NEW_TRACKS_DAILY_LIMIT: 5 });

    await expect(
      service.assertCanRequestTrack(USER, NOW),
    ).rejects.toMatchObject({
      code: 'PROCESSING_LIMIT_REACHED',
      details: { limit: 'NEW_TRACKS_PER_DAY', max: 5 },
    });
  });

  it('applies the active limit from the env instead of the default', async () => {
    repository.countActiveProcessings.mockResolvedValue(3);
    const service = await build({ PROCESSING_ACTIVE_LIMIT: 4 });

    await expect(service.assertCanRequestTrack(USER, NOW)).resolves.toBe(
      undefined,
    );
  });

  it('records the language the User browses in on their account', async () => {
    const service = await build();

    await service.recordLocale('user-1', 'pt-BR');

    expect(users.setLocale).toHaveBeenCalledWith('user-1', 'pt-BR');
  });
});
