import {
  type RecordingSummary,
  recordingSummarySchema,
} from '@notefinder/contracts';

/**
 * Minimal catalog summary for tests, parsed so it never drifts from the
 * contract. Only the MBID and title vary per case; art and genres are
 * irrelevant to the Track link.
 */
export const recordingSummary = (
  mbid: string,
  title: string,
): RecordingSummary =>
  recordingSummarySchema.parse({
    mbid,
    title,
    lengthMs: 180_000,
    disambiguation: '',
    video: false,
    artistCredit: { name: 'Test Artist', artists: [] },
    genres: [],
    primaryRelease: null,
  });
