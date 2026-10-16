import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';

/**
 * Where a Track contributor listing resumes: the entry that ends the previous
 * page, in first-contribution order. The Contributor ID breaks ties, so the
 * order is total.
 */
export type TrackContributorCursor = {
  contributedAt: string;
  contributorId: string;
};

const cursorTupleSchema = z.tuple([
  z.string().datetime(),
  z.string().min(1).max(128),
]);

/** Opaque to clients: a base64url JSON tuple of the cursor's two values. */
export const encodeTrackContributorCursor = ({
  contributedAt,
  contributorId,
}: TrackContributorCursor): string =>
  Buffer.from(JSON.stringify([contributedAt, contributorId]), 'utf8').toString(
    'base64url',
  );

/**
 * Decodes a cursor this API issued. Opaque means opaque: only the canonical
 * encoding of a cursor decodes, so raw IDs and tampered strings are refused
 * with `VALIDATION_FAILED` instead of silently listing from a random spot.
 */
export const decodeTrackContributorCursor = (
  cursor: string,
): TrackContributorCursor => {
  const invalid = () => new AppException('VALIDATION_FAILED', 'Invalid cursor');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const tuple = cursorTupleSchema.safeParse(parsed);
  if (!tuple.success) {
    throw invalid();
  }
  const [contributedAt, contributorId] = tuple.data;
  const decoded = { contributedAt, contributorId };
  if (encodeTrackContributorCursor(decoded) !== cursor) {
    throw invalid();
  }
  return decoded;
};
