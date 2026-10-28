import { Test } from '@nestjs/testing';
import { LOCALES } from '@vozzify/contracts';
import { PersonalHomeQueueService } from '../home/home-personal-queue.service.js';
import { UsersService } from '../users/users.service.js';
import { AttemptsService } from './attempts.service.js';
import { SubmitAttemptService } from './submit-attempt.service.js';

const attempts = { submitAttempt: vi.fn() };
const users = { revalidatePublicProfile: vi.fn() };
const personalRefresh = { scheduleRefresh: vi.fn() };

const body = {
  difficulty: 'NORMAL',
  octaveMode: 'ANY',
  transposeSemitones: 0,
  speed: 1,
  accuracy: 0.9,
  coverage: 0.95,
  forwardSkip: false,
  bleedSuspected: false,
  startedAt: '2026-10-16T10:00:00.000Z',
  endedAt: '2026-10-16T10:04:00.000Z',
} as const;

describe('SubmitAttemptService', () => {
  let service: SubmitAttemptService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubmitAttemptService,
        { provide: AttemptsService, useValue: attempts },
        { provide: UsersService, useValue: users },
        { provide: PersonalHomeQueueService, useValue: personalRefresh },
      ],
    }).compile();
    service = moduleRef.get(SubmitAttemptService);
  });

  // A saved run can change the User's Vocal range and Most sung artist chips,
  // which the cached public Profile shows: saving must refresh it.
  it('refreshes the public Profile of the User after the run is saved', async () => {
    const saved = { id: 'attempt-1' };
    attempts.submitAttempt.mockResolvedValue(saved);

    await expect(service.submit('user-1', 'track-1', body)).resolves.toBe(
      saved,
    );

    expect(attempts.submitAttempt).toHaveBeenCalledWith(
      'user-1',
      'track-1',
      body,
    );
    expect(users.revalidatePublicProfile).toHaveBeenCalledWith('user-1');
  });

  // A saved run changes the User's taste, so the personal snapshot is rebuilt
  // after the debounce delay, in every locale the User may read.
  it('schedules a debounced personal snapshot rebuild after the run is saved', async () => {
    attempts.submitAttempt.mockResolvedValue({ id: 'attempt-1' });

    await service.submit('user-1', 'track-1', body);

    expect(personalRefresh.scheduleRefresh).toHaveBeenCalledTimes(
      LOCALES.length,
    );
    for (const locale of LOCALES) {
      expect(personalRefresh.scheduleRefresh).toHaveBeenCalledWith(
        'user-1',
        locale,
      );
    }
  });

  it('refreshes nothing when the run is refused', async () => {
    const refusal = new Error('ATTEMPT_REJECTED');
    attempts.submitAttempt.mockRejectedValue(refusal);

    await expect(service.submit('user-1', 'track-1', body)).rejects.toBe(
      refusal,
    );
    expect(users.revalidatePublicProfile).not.toHaveBeenCalled();
    expect(personalRefresh.scheduleRefresh).not.toHaveBeenCalled();
  });
});
