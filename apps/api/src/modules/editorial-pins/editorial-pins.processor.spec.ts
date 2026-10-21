import { Test, type TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { INVALIDATE_HOME_FOR_PIN_JOB } from './editorial-pins.job.js';
import { EditorialPinsProcessor } from './editorial-pins.processor.js';

const revalidation = { revalidate: vi.fn() };

const job = (name: string, data: unknown) =>
  ({ name, data }) as Parameters<EditorialPinsProcessor['process']>[0];

describe('EditorialPinsProcessor', () => {
  let processor: EditorialPinsProcessor;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        EditorialPinsProcessor,
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    processor = moduleRef.get(EditorialPinsProcessor);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('revalidates the home of the locales the job names, at the moment it runs', async () => {
    await processor.process(
      job(INVALIDATE_HOME_FOR_PIN_JOB, { locales: ['pt-BR'] }),
    );

    expect(revalidation.revalidate).toHaveBeenCalledWith(['home:pt-BR']);
  });

  it('refuses a job it does not know, without retrying it', async () => {
    const error = await processor
      .process(job('something-else', { locales: ['en'] }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });

  it('refuses a job whose payload is invalid, without retrying it', async () => {
    const error = await processor
      .process(job(INVALIDATE_HOME_FOR_PIN_JOB, { locales: ['fr'] }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(revalidation.revalidate).not.toHaveBeenCalled();
  });
});
