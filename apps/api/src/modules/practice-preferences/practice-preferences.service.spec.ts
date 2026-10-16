import { Test } from '@nestjs/testing';
import { PracticePreferencesRepository } from './practice-preferences.repository.js';
import { PracticePreferencesService } from './practice-preferences.service.js';

const repository = { find: vi.fn(), upsert: vi.fn() };

const stored = {
  userId: 'user-1',
  difficulty: 'HARD',
  octaveMode: 'EXACT',
  guideMelody: true,
  countIn: false,
  createdAt: new Date('2026-10-16T10:00:00.000Z'),
  updatedAt: new Date('2026-10-16T10:00:00.000Z'),
};

describe('PracticePreferencesService', () => {
  let service: PracticePreferencesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PracticePreferencesService,
        { provide: PracticePreferencesRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(PracticePreferencesService);
  });

  it('reads the stored preferences without the row metadata', async () => {
    repository.find.mockResolvedValue(stored);

    await expect(service.get('user-1')).resolves.toEqual({
      difficulty: 'HARD',
      octaveMode: 'EXACT',
      guideMelody: true,
      countIn: false,
    });
    expect(repository.find).toHaveBeenCalledWith('user-1');
  });

  it('answers the page defaults until the first change', async () => {
    repository.find.mockResolvedValue(undefined);

    await expect(service.get('user-1')).resolves.toEqual({
      difficulty: 'NORMAL',
      octaveMode: 'ANY',
      guideMelody: false,
      countIn: true,
    });
  });

  it('writes only the changed preferences and reads back the row', async () => {
    repository.upsert.mockResolvedValue({ ...stored, difficulty: 'EASY' });

    await expect(
      service.update('user-1', { difficulty: 'EASY' }),
    ).resolves.toEqual({
      difficulty: 'EASY',
      octaveMode: 'EXACT',
      guideMelody: true,
      countIn: false,
    });
    expect(repository.upsert).toHaveBeenCalledWith('user-1', {
      difficulty: 'EASY',
    });
  });
});
