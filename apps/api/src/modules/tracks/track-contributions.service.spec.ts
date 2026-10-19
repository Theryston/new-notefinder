import { Test } from '@nestjs/testing';
import { TrackContributionsService } from './track-contributions.service.js';
import { TrackContributorRepository } from './track-contributor.repository.js';

const contributors = { countContributionsOf: vi.fn() };

describe('TrackContributionsService', () => {
  let service: TrackContributionsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackContributionsService,
        { provide: TrackContributorRepository, useValue: contributors },
      ],
    }).compile();
    service = moduleRef.get(TrackContributionsService);
  });

  it('counts the Contributions of the User through the repository', async () => {
    contributors.countContributionsOf.mockResolvedValue(5);

    await expect(service.countOf('user-1')).resolves.toBe(5);
    expect(contributors.countContributionsOf).toHaveBeenCalledWith('user-1');
  });
});
