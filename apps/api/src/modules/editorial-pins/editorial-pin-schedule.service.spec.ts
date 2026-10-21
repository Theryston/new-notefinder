import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import type { EditorialPin } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { EditorialPinScheduleService } from './editorial-pin-schedule.service.js';
import {
  EDITORIAL_PIN_QUEUE,
  INVALIDATE_HOME_FOR_PIN_JOB,
} from './editorial-pins.job.js';

const queue = { add: vi.fn() };
const revalidation = { revalidate: vi.fn() };

const NOW = new Date('2026-10-20T12:00:00.000Z');

const pinWith = (overrides: Partial<EditorialPin> = {}): EditorialPin => ({
  id: 'pin-1',
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds: ['t1'] },
  position: 1,
  priority: 0,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Festive' },
  sponsored: false,
  createdBy: null,
  updatedBy: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides,
});

describe('EditorialPinScheduleService', () => {
  let service: EditorialPinScheduleService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        EditorialPinScheduleService,
        {
          provide: getQueueToken(EDITORIAL_PIN_QUEUE),
          useValue: queue,
        },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(EditorialPinScheduleService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('revalidates the home tag of each locale now', async () => {
    await service.invalidateNow(['en', 'pt-BR']);

    expect(revalidation.revalidate).toHaveBeenCalledWith([
      'home:en',
      'home:pt-BR',
    ]);
  });

  it('schedules the start and the end of a pin that are still ahead, at their exact time', async () => {
    const startsAt = '2026-10-21T00:00:00.000Z';
    const endsAt = '2026-10-22T00:00:00.000Z';

    await service.scheduleEdges(pinWith({ startsAt, endsAt }), NOW);

    const startDelay = Date.parse(startsAt) - NOW.getTime();
    const endDelay = Date.parse(endsAt) - NOW.getTime();
    expect(queue.add).toHaveBeenCalledWith(
      INVALIDATE_HOME_FOR_PIN_JOB,
      { locales: ['en', 'pt-BR'] },
      expect.objectContaining({
        jobId: `editorial-pin-pin-1-start-${Date.parse(startsAt)}`,
        delay: startDelay,
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      INVALIDATE_HOME_FOR_PIN_JOB,
      { locales: ['en', 'pt-BR'] },
      expect.objectContaining({
        jobId: `editorial-pin-pin-1-end-${Date.parse(endsAt)}`,
        delay: endDelay,
      }),
    );
  });

  it('schedules only the locale of a locale-limited pin', async () => {
    await service.scheduleEdges(
      pinWith({ locale: 'pt-BR', endsAt: '2026-10-22T00:00:00.000Z' }),
      NOW,
    );

    expect(queue.add).toHaveBeenCalledWith(
      INVALIDATE_HOME_FOR_PIN_JOB,
      { locales: ['pt-BR'] },
      expect.any(Object),
    );
  });

  it('schedules nothing for an edge already in the past or an indefinite pin', async () => {
    await service.scheduleEdges(
      pinWith({
        startsAt: '2026-10-19T00:00:00.000Z',
        endsAt: null,
      }),
      NOW,
    );

    expect(queue.add).not.toHaveBeenCalled();
  });
});
