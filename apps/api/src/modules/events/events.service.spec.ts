import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { HomeEvent } from '@notefinder/contracts';
import { EVENTS_QUEUE } from './events.job.js';
import { EventsService } from './events.service.js';

const impression = (rowId = 'row-0'): HomeEvent => ({
  type: 'home.row_impression',
  rowId,
  feedVersion: 'a1b2c3d4e5f60718',
  algorithmVersion: 1,
  items: [{ id: 'track-1', position: 0 }],
});

const click: HomeEvent = {
  type: 'home.item_click',
  rowId: 'row-0',
  feedVersion: 'a1b2c3d4e5f60718',
  algorithmVersion: 1,
  itemId: 'track-1',
  position: 2,
};

describe('EventsService', () => {
  const queue = { add: vi.fn() };

  let service: EventsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getQueueToken(EVENTS_QUEUE), useValue: queue },
      ],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('queues the batch and reports how many it accepted', async () => {
    await expect(
      service.record({
        visitorId: 'visitor-1',
        userId: undefined,
        userAgent: 'Mozilla/5.0',
        events: [impression(), click],
      }),
    ).resolves.toEqual({ accepted: 2 });

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, rows] = queue.add.mock.calls[0] as [string, unknown[]];
    expect(name).toBe('store-events');
    expect(rows).toHaveLength(2);
  });

  it('stores the User with a signed-in batch, and none with an anonymous one', async () => {
    await service.record({
      visitorId: 'visitor-1',
      userId: 'user-1',
      userAgent: undefined,
      events: [impression()],
    });

    const [, rows] = queue.add.mock.calls[0] as [string, { userId: unknown }[]];
    expect(rows[0]?.userId).toBe('user-1');

    await service.record({
      visitorId: 'visitor-1',
      userId: undefined,
      userAgent: undefined,
      events: [impression()],
    });

    const [, anonRows] = queue.add.mock.calls[1] as [
      string,
      { userId: unknown }[],
    ];
    expect(anonRows[0]?.userId).toBeNull();
  });

  it('keeps the raw event in the payload, with the row columns beside it', async () => {
    const event = impression('row-3');
    await service.record({
      visitorId: 'visitor-1',
      userId: undefined,
      userAgent: undefined,
      events: [event],
    });

    const [, rows] = queue.add.mock.calls[0] as [
      string,
      {
        type: unknown;
        rowId: unknown;
        feedVersion: unknown;
        algorithmVersion: unknown;
        itemId: unknown;
        position: unknown;
        payload: unknown;
      }[],
    ];
    expect(rows[0]).toMatchObject({
      type: 'home.row_impression',
      rowId: 'row-3',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
      itemId: null,
      position: null,
      payload: event,
    });
  });

  it('drops a bot batch after the 202, queueing nothing', async () => {
    await expect(
      service.record({
        visitorId: 'visitor-1',
        userId: undefined,
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        events: [impression()],
      }),
    ).resolves.toEqual({ accepted: 0 });

    expect(queue.add).not.toHaveBeenCalled();
  });
});
