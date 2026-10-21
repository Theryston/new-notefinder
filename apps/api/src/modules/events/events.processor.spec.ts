import { Test, type TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { STORE_EVENTS_JOB } from './events.job.js';
import { EventsProcessor } from './events.processor.js';
import { EventsRepository } from './events.repository.js';

const repository = { insertMany: vi.fn() };

const batch = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    visitorId: 'visitor-1',
    userId: null,
    type: 'home.row_impression',
    rowId: `row-${index}`,
    feedVersion: 'a1b2c3d4e5f60718',
    algorithmVersion: 1,
    itemId: null,
    position: null,
    payload: { type: 'home.row_impression' },
  }));

const job = (name: string, data: unknown) =>
  ({ name, data }) as Parameters<EventsProcessor['process']>[0];

describe('EventsProcessor', () => {
  let processor: EventsProcessor;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        EventsProcessor,
        { provide: EventsRepository, useValue: repository },
      ],
    }).compile();
    processor = moduleRef.get(EventsProcessor);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('stores the whole batch with one repository call', async () => {
    await processor.process(job(STORE_EVENTS_JOB, batch(3)));

    expect(repository.insertMany).toHaveBeenCalledTimes(1);
    expect(repository.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ rowId: 'row-0' })]),
    );
  });

  it('refuses a job it does not know, without retrying it', async () => {
    const error = await processor
      .process(job('something-else', batch(1)))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(repository.insertMany).not.toHaveBeenCalled();
  });

  it('refuses a job whose payload is invalid, without retrying it', async () => {
    const error = await processor
      .process(job(STORE_EVENTS_JOB, [{ nope: true }]))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(repository.insertMany).not.toHaveBeenCalled();
  });
});
