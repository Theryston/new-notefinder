import { Test, type TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { TrackCoverJob } from './track-cover-job.service.js';
import { TrackJobRunner } from './track-job-runner.service.js';
import { TrackPipeline } from './track-pipeline.service.js';

const pipeline = { runStep: vi.fn() };
const coverJob = { run: vi.fn() };

describe('TrackJobRunner', () => {
  let runner: TrackJobRunner;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackJobRunner,
        { provide: TrackPipeline, useValue: pipeline },
        { provide: TrackCoverJob, useValue: coverJob },
      ],
    }).compile();
    runner = moduleRef.get(TrackJobRunner);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('sends a step job to the pipeline, with its parsed payload', async () => {
    await runner.run(
      'run-step',
      { processingId: 'processing-1', step: 'FINDING_VIDEO' },
      true,
    );

    expect(pipeline.runStep).toHaveBeenCalledWith(
      { processingId: 'processing-1', step: 'FINDING_VIDEO' },
      true,
    );
  });

  it('sends a cover job to the cover job, telling it the attempt is not the last', async () => {
    await runner.run('store-cover', { trackId: 'track-1' }, false);

    expect(coverJob.run).toHaveBeenCalledWith('track-1', false);
  });

  it('refuses a job it does not know, without retrying it', async () => {
    await expect(runner.run('send-email', {}, true)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('refuses a payload that breaks its schema, without retrying it', async () => {
    await expect(
      runner.run(
        'run-step',
        { processingId: 'processing-1', step: 'NOPE' },
        true,
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(runner.run('store-cover', {}, true)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(pipeline.runStep).not.toHaveBeenCalled();
    expect(coverJob.run).not.toHaveBeenCalled();
  });
});
