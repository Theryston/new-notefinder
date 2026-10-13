import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

describe('TracksService.assertTrackExists', () => {
  let service: TracksService;
  const repository = {
    findTrackHeader: vi.fn(),
    findTrackIdByLegacyId: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TracksService,
        { provide: TracksRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(TracksService);
  });

  it('resolves for a Track that exists, without looking at the legacy IDs', async () => {
    repository.findTrackHeader.mockResolvedValue({ id: 'track-1' });

    await expect(service.assertTrackExists('track-1')).resolves.toBeUndefined();
    expect(repository.findTrackIdByLegacyId).not.toHaveBeenCalled();
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    repository.findTrackHeader.mockResolvedValue(undefined);
    repository.findTrackIdByLegacyId.mockResolvedValue('track-1');

    const error = await service.assertTrackExists('legacy').catch((e) => e);

    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({ code: 'RESOURCE_MOVED' });
    expect(error.details).toEqual({ id: 'track-1' });
  });

  it('answers NOT_FOUND for an unknown ID', async () => {
    repository.findTrackHeader.mockResolvedValue(undefined);
    repository.findTrackIdByLegacyId.mockResolvedValue(undefined);

    await expect(service.assertTrackExists('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
