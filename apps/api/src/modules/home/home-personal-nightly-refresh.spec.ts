import { Test } from '@nestjs/testing';
import { REFRESH_PERSONAL_NIGHTLY_JOB } from './home-personal.job.js';
import { PersonalHomeProcessor } from './home-personal.processor.js';
import { PersonalHomeRepository } from './home-personal.repository.js';
import { PersonalHomeStore } from './home-personal.store.js';
import { PersonalHomeBuilder } from './home-personal-builder.service.js';
import { PersonalHomeQueueService } from './home-personal-queue.service.js';
import { HomeSocialService } from './home-social.service.js';

describe('PersonalHomeProcessor nightly refreshes', () => {
  it('refreshes both community cooccurrence and social pairs', async () => {
    const builder = {
      build: vi.fn(),
      refreshCommunityCooccurrence: vi.fn().mockResolvedValue(undefined),
    };
    const store = {};
    const personal = {
      findActiveUserIds: vi.fn().mockResolvedValue(['user-1']),
    };
    const queue = { scheduleRefresh: vi.fn().mockResolvedValue(undefined) };
    const social = { refreshFor: vi.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PersonalHomeProcessor,
        { provide: PersonalHomeBuilder, useValue: builder },
        { provide: PersonalHomeStore, useValue: store },
        { provide: PersonalHomeRepository, useValue: personal },
        { provide: PersonalHomeQueueService, useValue: queue },
        { provide: HomeSocialService, useValue: social },
      ],
    }).compile();

    await moduleRef.get(PersonalHomeProcessor).process({
      name: REFRESH_PERSONAL_NIGHTLY_JOB,
      data: {},
    } as Parameters<PersonalHomeProcessor['process']>[0]);

    expect(builder.refreshCommunityCooccurrence).toHaveBeenCalledOnce();
    expect(social.refreshFor).toHaveBeenCalledOnce();
    expect(social.refreshFor).toHaveBeenCalledWith('user-1');
  });
});
