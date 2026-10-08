import { TrackJobRunner } from '../../src/modules/tracks/track-job-runner.service.js';
import { TRACK_PROCESSING_QUEUE } from '../../src/modules/tracks/track-processing.job.js';
import type { TestApp } from './create-test-app.js';

/**
 * The jobs the Processing queue holds that have not run yet, in order. Reading
 * them does not run or remove them.
 */
export const queuedTrackJobs = (testApp: TestApp) => [
  ...(testApp.queues[TRACK_PROCESSING_QUEUE]?.added ?? []),
];

/**
 * Runs the job at the head of the Processing queue, as its last attempt, and
 * leaves the jobs it queues in the queue. Answers the job's name.
 */
export async function runNextTrackJob(
  testApp: TestApp,
): Promise<string | undefined> {
  const job = testApp.queues[TRACK_PROCESSING_QUEUE]?.added.shift();
  if (job === undefined) {
    return undefined;
  }
  await testApp.app.get(TrackJobRunner).run(job.name, job.data, true);
  return job.name;
}

/**
 * Runs every job the Processing queue holds, the way BullMQ would if each one
 * failed on its last attempt, and the jobs a job queues run after it. A job
 * is taken off the queue when it runs.
 */
export async function runTrackJobs(testApp: TestApp): Promise<void> {
  const queue = testApp.queues[TRACK_PROCESSING_QUEUE];
  const runner = testApp.app.get(TrackJobRunner);
  for (
    let job = queue?.added.shift();
    job !== undefined;
    job = queue?.added.shift()
  ) {
    await runner.run(job.name, job.data, true);
  }
}
