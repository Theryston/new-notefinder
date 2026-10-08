import { z } from 'zod';
import { AppException } from '../../common/errors/app-exception.js';

/**
 * Where an album track listing resumes: the entry that ends the previous
 * page, in album order. The Track ID breaks ties, so the order is total.
 */
export type AlbumTrackCursor = {
  discPosition: number;
  trackPosition: number;
  trackId: string;
};

const cursorTupleSchema = z.tuple([
  z.number().int().min(1),
  z.number().int().min(1),
  z.string().min(1).max(128),
]);

/** Opaque to clients: a base64url JSON tuple of the cursor's three values. */
export const encodeAlbumTrackCursor = ({
  discPosition,
  trackPosition,
  trackId,
}: AlbumTrackCursor): string =>
  Buffer.from(
    JSON.stringify([discPosition, trackPosition, trackId]),
    'utf8',
  ).toString('base64url');

/**
 * Decodes a cursor this API issued. Opaque means opaque: only the canonical
 * encoding of a cursor decodes, so raw IDs and tampered strings are refused
 * with `VALIDATION_FAILED` instead of silently listing from a random spot.
 */
export const decodeAlbumTrackCursor = (cursor: string): AlbumTrackCursor => {
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
  const [discPosition, trackPosition, trackId] = tuple.data;
  const decoded = { discPosition, trackPosition, trackId };
  if (encodeAlbumTrackCursor(decoded) !== cursor) {
    throw invalid();
  }
  return decoded;
};
