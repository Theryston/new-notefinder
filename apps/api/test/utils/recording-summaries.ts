import {
  type RecordingSummary,
  recordingSummarySchema,
} from '@vozzify/contracts';

/**
 * Minimal compact catalog result for tests, parsed against the protocol
 * contract. Only the MBID and title vary per case.
 */
export const recordingSummary = (
  mbid: string,
  title: string,
): RecordingSummary =>
  recordingSummarySchema.parse({
    mbid,
    title,
    artistCredit: 'Test Artist',
    coverUrl: null,
    trackId: null,
  });
