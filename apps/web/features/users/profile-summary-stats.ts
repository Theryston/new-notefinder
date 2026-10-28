import type { PublicProfileSummary } from '@vozzify/contracts';

/**
 * The numbers of the Summary section, in display order. The component and its
 * skeleton both read this list, so adding a stat is one edit here plus its
 * contract field and messages.
 */
export const PROFILE_SUMMARY_STATS = [
  'streak',
  'sung',
  'favorites',
  'contributions',
] as const;

export type ProfileSummaryStat = (typeof PROFILE_SUMMARY_STATS)[number];

/**
 * The stats to show, in display order. A counter the API withheld (`null`:
 * its section is hidden from this visitor) is left out, not shown as a zero.
 */
export function shownSummaryStats(
  summary: PublicProfileSummary,
): ProfileSummaryStat[] {
  return PROFILE_SUMMARY_STATS.filter(
    (stat) => summary[PROFILE_SUMMARY_FIELDS[stat]] !== null,
  );
}

/** Which field of the contract each stat shows. */
export const PROFILE_SUMMARY_FIELDS: Record<
  ProfileSummaryStat,
  keyof PublicProfileSummary
> = {
  streak: 'streakDays',
  sung: 'sungCount',
  favorites: 'favoritesCount',
  contributions: 'contributionsCount',
};
