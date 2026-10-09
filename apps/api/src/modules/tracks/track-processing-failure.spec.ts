import { Logger } from '@nestjs/common';
import {
  attemptStepCall,
  TrackProcessingFailure,
} from './track-processing-failure.js';

describe('attemptStepCall', () => {
  const logger = new Logger('test');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers what the call answers', async () => {
    await expect(
      attemptStepCall(logger, 'DOWNLOAD_FAILED', 'fetch', async () => 'bytes'),
    ).resolves.toBe('bytes');
  });

  it('turns a failure of the call into a failure with its code, and logs the cause', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const failure = attemptStepCall(
      logger,
      'NOTE_DETECTION_FAILED',
      'start the note detection',
      () => Promise.reject(new Error('RunPod answered HTTP 503')),
    );

    await expect(failure).rejects.toBeInstanceOf(TrackProcessingFailure);
    await expect(failure).rejects.toMatchObject({
      code: 'NOTE_DETECTION_FAILED',
      message: 'Processing failed: NOTE_DETECTION_FAILED',
    });
    expect(warn).toHaveBeenCalledWith(
      'Could not start the note detection: RunPod answered HTTP 503',
    );
  });

  it('logs a failure that is not an error as its text', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    await expect(
      attemptStepCall(logger, 'DOWNLOAD_FAILED', 'fetch', () =>
        Promise.reject('timeout'),
      ),
    ).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
    expect(warn).toHaveBeenCalledWith('Could not fetch: timeout');
  });
});
