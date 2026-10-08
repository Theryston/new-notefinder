import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { TrackPipeline } from './track-pipeline.service.js';
import { coverJobId, TRACK_PROCESSING_QUEUE } from './track-processing.job.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingFailure } from './track-processing-failure.js';
import { TrackVideoStep } from './track-video-step.service.js';

// The pipeline's decisions: what a step job does with its outcome. The rows
// and the queue are fakes; the database-facing parts are covered by e2e.

const queue = { add: vi.fn() };
const processings = {
  findLatestProcessing: vi.fn(),
  findProcessing: vi.fn(),
  markStepStarted: vi.fn(),
  markFailed: vi.fn(),
  markCompleted: vi.fn(),
};
const videoStep = { run: vi.fn() };
const revalidation = { revalidate: vi.fn() };

const processing = (overrides: Record<string, unknown> = {}) => ({
  id: 'processing-1',
  trackId: 'track-1',
  status: 'QUEUED',
  videoId: null,
  videoSource: null,
  ...overrides,
});

const findingVideoJob = {
  processingId: 'processing-1',
  step: 'FINDING_VIDEO',
} as const;

describe('TrackPipeline', () => {
  let pipeline: TrackPipeline;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    // `clearAllMocks` keeps implementations: each case starts from success.
    videoStep.run.mockResolvedValue(undefined);
    queue.add.mockResolvedValue(undefined);
    moduleRef = await Test.createTestingModule({
      providers: [
        TrackPipeline,
        { provide: getQueueToken(TRACK_PROCESSING_QUEUE), useValue: queue },
        { provide: TrackProcessingRepository, useValue: processings },
        { provide: TrackVideoStep, useValue: videoStep },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    pipeline = moduleRef.get(TrackPipeline);
  });

  describe('start', () => {
    it('queues the first step of the latest Processing of the Track', async () => {
      processings.findLatestProcessing.mockResolvedValue({
        id: 'processing-1',
      });

      await pipeline.start('track-1');

      expect(processings.findLatestProcessing).toHaveBeenCalledWith('track-1');
      expect(queue.add).toHaveBeenCalledWith('run-step', findingVideoJob, {
        jobId: 'step-processing-1-FINDING_VIDEO',
      });
    });

    it('refuses a Track with no Processing to start', async () => {
      processings.findLatestProcessing.mockResolvedValue(undefined);

      await expect(pipeline.start('track-1')).rejects.toThrow(
        'has no Processing to start',
      );
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('runStep', () => {
    it('does nothing for a Processing that is gone', async () => {
      processings.findProcessing.mockResolvedValue(undefined);

      await pipeline.runStep(findingVideoJob, true);

      expect(processings.markStepStarted).not.toHaveBeenCalled();
      expect(videoStep.run).not.toHaveBeenCalled();
    });

    it('does nothing for a Processing that is past the step', async () => {
      processings.findProcessing.mockResolvedValue(
        processing({ status: 'COMPLETED' }),
      );

      await pipeline.runStep(findingVideoJob, true);

      expect(processings.markStepStarted).not.toHaveBeenCalled();
      expect(videoStep.run).not.toHaveBeenCalled();
    });

    it('completes the Processing after the last step, revalidating the Track', async () => {
      processings.findProcessing.mockResolvedValue(processing());

      await pipeline.runStep(findingVideoJob, true);

      expect(processings.markStepStarted).toHaveBeenCalledWith(
        'processing-1',
        'FINDING_VIDEO',
      );
      expect(videoStep.run).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'processing-1', trackId: 'track-1' }),
      );
      expect(processings.markCompleted).toHaveBeenCalledWith('processing-1');
      expect(revalidation.revalidate).toHaveBeenCalledWith([
        'track:track-1',
        'tracks',
      ]);
    });

    it('queues the cover after the video is chosen, without waiting for it', async () => {
      processings.findProcessing.mockResolvedValue(processing());

      await pipeline.runStep(findingVideoJob, true);

      expect(queue.add).toHaveBeenCalledWith(
        'store-cover',
        { trackId: 'track-1' },
        { jobId: coverJobId('track-1') },
      );
    });

    it('ends the Processing at once on a failure that repeating cannot fix', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      videoStep.run.mockRejectedValue(
        new TrackProcessingFailure('VIDEO_NOT_FOUND'),
      );

      await expect(pipeline.runStep(findingVideoJob, false)).resolves.toBe(
        undefined,
      );

      expect(processings.markFailed).toHaveBeenCalledWith('processing-1', {
        code: 'VIDEO_NOT_FOUND',
        resumeFrom: 'FINDING_VIDEO',
      });
      expect(processings.markCompleted).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('lets BullMQ retry a retryable failure before its last attempt', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      const failure = new TrackProcessingFailure('DOWNLOAD_FAILED');
      videoStep.run.mockRejectedValue(failure);

      await expect(pipeline.runStep(findingVideoJob, false)).rejects.toBe(
        failure,
      );

      expect(processings.markFailed).not.toHaveBeenCalled();
    });

    it('marks a retryable failure FAILED with its code on the last attempt', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      videoStep.run.mockRejectedValue(
        new TrackProcessingFailure('DOWNLOAD_FAILED'),
      );

      await pipeline.runStep(findingVideoJob, true);

      expect(processings.markFailed).toHaveBeenCalledWith('processing-1', {
        code: 'DOWNLOAD_FAILED',
        resumeFrom: 'FINDING_VIDEO',
      });
    });

    it('lets BullMQ retry an unexpected error before its last attempt', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      const error = new Error('YouTube is down');
      videoStep.run.mockRejectedValue(error);

      await expect(pipeline.runStep(findingVideoJob, false)).rejects.toBe(
        error,
      );

      expect(processings.markFailed).not.toHaveBeenCalled();
    });

    it('marks a failure after the video is saved INTERNAL on the last attempt', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      queue.add.mockRejectedValueOnce(new Error('redis is down'));

      await pipeline.runStep(findingVideoJob, true);

      expect(videoStep.run).toHaveBeenCalled();
      expect(processings.markFailed).toHaveBeenCalledWith('processing-1', {
        code: 'INTERNAL',
        resumeFrom: 'FINDING_VIDEO',
      });
      expect(processings.markCompleted).not.toHaveBeenCalled();
    });

    it('lets BullMQ retry a failure after the video is saved before its last attempt', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      queue.add.mockRejectedValueOnce(new Error('redis is down'));

      await expect(pipeline.runStep(findingVideoJob, false)).rejects.toThrow(
        'redis is down',
      );
      expect(processings.markFailed).not.toHaveBeenCalled();
    });

    it('marks an unexpected error INTERNAL on the last attempt', async () => {
      processings.findProcessing.mockResolvedValue(processing());
      videoStep.run.mockRejectedValue(new Error('YouTube is down'));

      await pipeline.runStep(findingVideoJob, true);

      expect(processings.markFailed).toHaveBeenCalledWith('processing-1', {
        code: 'INTERNAL',
        resumeFrom: 'FINDING_VIDEO',
      });
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });
  });
});
