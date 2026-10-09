import { z } from 'zod';

// The answers of RunPod's serverless API, for the endpoint that runs
// apps/nfp-audio (ADR 0004). A job starts with `/run` and its state is read
// from `/status`. The worker reports each stage as a progress update, which
// `/status` answers as the output of a running job; a finished job answers the
// worker's output. Parsed here, so the client only moves JSON and the rules of
// a job's state are testable on their own.

/** The stages a running job reports, in order. Their names are the worker's contract. */
const RUNPOD_STAGES = ['EXTRACTING_VOCALS', 'DETECTING_NOTES'] as const;

type RunpodStage = (typeof RUNPOD_STAGES)[number];

/** The statuses a job ends in without an output to use. */
const FAILED_STATUSES: readonly string[] = ['FAILED', 'CANCELLED', 'TIMED_OUT'];

const runResponseSchema = z.object({ id: z.string().min(1) });

const statusResponseSchema = z.object({
  status: z.string(),
  // Absent until the job reports or ends with one.
  output: z.unknown().optional(),
});

/**
 * Where a job stands. A running job names the stage it reported, when it has
 * reported one yet.
 */
export type RunpodJobState =
  | { kind: 'running'; stage: RunpodStage | undefined }
  | { kind: 'completed'; output: unknown }
  | { kind: 'failed' };

/** The RunPod job ID a `/run` answer starts. */
export const runpodJobIdOf = (body: unknown): string =>
  runResponseSchema.parse(body).id;

/**
 * The state of a job from its `/status` answer. Any status that is neither
 * completed nor failed (queued, running, or a status RunPod adds later) is
 * still running, and the step's budget bounds the wait.
 */
export const runpodJobStateOf = (body: unknown): RunpodJobState => {
  const { status, output } = statusResponseSchema.parse(body);
  if (status === 'COMPLETED') {
    return { kind: 'completed', output };
  }
  if (FAILED_STATUSES.includes(status)) {
    return { kind: 'failed' };
  }
  return { kind: 'running', stage: stageOf(output) };
};

/** The stage a progress update names; anything else names none. */
const stageOf = (output: unknown): RunpodStage | undefined =>
  RUNPOD_STAGES.find((stage) => stage === output);
