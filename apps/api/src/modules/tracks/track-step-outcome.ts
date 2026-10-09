// What a step leaves for the pipeline (pure). A step is either done, and the
// pipeline moves on, or it has to be checked again later: a long wait (a
// RapidAPI conversion) is a delayed re-check job, never a blocking loop.

/** The step is finished: the pipeline queues the next one, or completes. */
export type DoneOutcome = { kind: 'done' };

/** The step must run again after `delayMs`, with `state` as its re-check's state. */
export type WaitOutcome = { kind: 'wait'; delayMs: number; state: unknown };

export type StepOutcome = DoneOutcome | WaitOutcome;

export const DONE: DoneOutcome = { kind: 'done' };

export const waitFor = (delayMs: number, state: unknown): WaitOutcome => ({
  kind: 'wait',
  delayMs,
  state,
});
