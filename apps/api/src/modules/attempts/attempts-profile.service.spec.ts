import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsProfileService } from './attempts-profile.service.js';

describe('AttemptsProfileService', () => {
  it('derives batched vocal ranges using the existing profile chip rules', async () => {
    const attempts = {
      listVocalRangeGroupsByUserIds: vi.fn().mockResolvedValue([
        {
          userId: 'singer',
          trackVocalRangeLowest: 48,
          trackVocalRangeHighest: 72,
          transposeSemitones: 2,
          forwardSkip: false,
          bleedSuspected: false,
          bestAccuracy: 0.9,
        },
        {
          userId: 'singer',
          trackVocalRangeLowest: 36,
          trackVocalRangeHighest: 50,
          transposeSemitones: 0,
          forwardSkip: false,
          bleedSuspected: false,
          bestAccuracy: 0.7,
        },
      ]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttemptsProfileService,
        { provide: AttemptsRepository, useValue: attempts },
      ],
    }).compile();
    const service = moduleRef.get(AttemptsProfileService);

    await expect(
      service.vocalRangesForUsers(['singer', 'quiet']),
    ).resolves.toEqual(
      new Map([
        ['singer', { lowest: 50, highest: 74 }],
        ['quiet', null],
      ]),
    );
    expect(attempts.listVocalRangeGroupsByUserIds).toHaveBeenCalledWith([
      'singer',
      'quiet',
    ]);
    await moduleRef.close();
  });
});
