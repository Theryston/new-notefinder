import type { PublicProfileSummary } from '@notefinder/contracts';

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
