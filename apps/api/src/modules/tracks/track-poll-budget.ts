// The budget of the re-checks of an external job (ADR 0004), shared by the
// polling modules of the steps that wait for one (audio conversion, note
// detection). Each module owns its interval and its maximum.

/**
 * Whether a re-check that finds the job still running has used up the budget
 * of `maxPolls` checks. `round` counts the checks, from 1.
 */
export const isPollBudgetSpentAt = (round: number, maxPolls: number): boolean =>
  round >= maxPolls;
