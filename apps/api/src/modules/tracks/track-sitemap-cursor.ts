import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';

/** Where a sitemap listing resumes: the entry that ends the previous page. */
export type TrackSitemapCursor = { score: number; trackId: string };

const tupleSchema = z.tuple([
  z.number().int().nonnegative(),
  z.string().min(1).max(128),
]);

/** Opaque to clients: a base64url JSON tuple of the score and Track ID. */
export const encodeTrackSitemapCursor = ({
  score,
  trackId,
}: TrackSitemapCursor): string =>
  Buffer.from(JSON.stringify([score, trackId]), 'utf8').toString('base64url');

/**
 * Decodes a cursor this API issued; anything else (raw IDs, tampered strings)
 * is `VALIDATION_FAILED` instead of listing from a random spot.
 */
export const decodeTrackSitemapCursor = (
  cursor: string,
): TrackSitemapCursor => {
  let tuple: z.infer<typeof tupleSchema> | undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    tuple = tupleSchema.parse(parsed);
  } catch {
    tuple = undefined;
  }
  const decoded = tuple && { score: tuple[0], trackId: tuple[1] };
  if (!decoded || encodeTrackSitemapCursor(decoded) !== cursor) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  return decoded;
};
