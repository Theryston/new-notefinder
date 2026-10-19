import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service.js';
import { AttemptsService } from './attempts.service.js';
import { SubmitAttemptService } from './submit-attempt.service.js';

const attempts = { submitAttempt: vi.fn() };
const users = { revalidatePublicProfile: vi.fn() };

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

  it('refreshes nothing when the run is refused', async () => {
    const refusal = new Error('ATTEMPT_REJECTED');
    attempts.submitAttempt.mockRejectedValue(refusal);

    await expect(service.submit('user-1', 'track-1', body)).rejects.toBe(
      refusal,
    );
    expect(users.revalidatePublicProfile).not.toHaveBeenCalled();
  });
});
