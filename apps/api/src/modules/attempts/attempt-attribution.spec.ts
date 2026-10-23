import { Test } from '@nestjs/testing';
import { TracksService } from '../tracks/tracks.service.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';

describe('AttemptsService view attribution', () => {
  it('stores the Track view with a valid practice run', async () => {
    const row = {
      id: 'attempt-1',
      userId: 'user-1',
      trackId: 'track-1',
      difficulty: 'NORMAL' as const,
      octaveMode: 'ANY' as const,
      transposeSemitones: 0,
      speed: 1,
      accuracy: 0.8,
      coverage: 0.95,
      forwardSkip: false,
      bleedSuspected: false,
      startedAt: new Date('2026-10-22T10:00:00.000Z'),
      endedAt: new Date('2026-10-22T10:04:00.000Z'),
      viewId: 'view-1',
      createdAt: new Date('2026-10-22T10:04:01.000Z'),
      updatedAt: new Date('2026-10-22T10:04:01.000Z'),
    };
    const attempts = { insert: vi.fn().mockResolvedValue(row) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: AttemptsRepository, useValue: attempts },
        { provide: TracksService, useValue: { assertTrackExists: vi.fn() } },
      ],
    }).compile();

    try {
      const service = moduleRef.get(AttemptsService);
      await service.submitAttempt('user-1', 'track-1', {
        difficulty: 'NORMAL',
        octaveMode: 'ANY',
        transposeSemitones: 0,
        speed: 1,
        accuracy: 0.8,
        coverage: 0.95,
        forwardSkip: false,
        bleedSuspected: false,
        startedAt: '2026-10-22T10:00:00.000Z',
        endedAt: '2026-10-22T10:04:00.000Z',
        viewId: 'view-1',
      });

      expect(attempts.insert).toHaveBeenCalledWith(
        expect.objectContaining({ viewId: 'view-1' }),
      );
    } finally {
      await moduleRef.close();
    }
  });
});
