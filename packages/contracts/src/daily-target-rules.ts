/**
 * Daily target rules shared by the API and the clients. Kept free of Zod so
 * clients can import them (`@vozzify/contracts/daily-target-rules`)
 * without shipping the schema library on first load.
 */

/**
 * The Daily target presets a User can pick, in seconds (5, 10, 15 and
 * 30 minutes). The only values ever stored: anything else is rejected.
 */
export const DAILY_PRACTICE_TARGET_SECONDS = [300, 600, 900, 1800] as const;

export type DailyPracticeTargetSeconds =
  (typeof DAILY_PRACTICE_TARGET_SECONDS)[number];

/**
 * The target of a User who never picked one, like the 5-minute fallback the
 * streak always used.
 */
export const DEFAULT_DAILY_PRACTICE_TARGET_SECONDS: DailyPracticeTargetSeconds = 300;

/**
 * The stored value as one of the presets: anything that is not a preset
 * (including null and missing) reads as null, which clients show as the
 * fallback. The column predates the presets, so a legacy row may hold any
 * integer; narrowing happens at the read boundary, never by migration.
 */
export const asDailyPracticeTargetSeconds = (
  seconds: number | null | undefined,
): DailyPracticeTargetSeconds | null =>
  DAILY_PRACTICE_TARGET_SECONDS.find((preset) => preset === seconds) ?? null;
