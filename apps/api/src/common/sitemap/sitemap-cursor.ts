import { AppException } from '../errors/app-exception.js';

// IDs are short text (cuid2 or a legacy cuid); anything longer is not one.
const MAX_ID_LENGTH = 128;

/**
 * Opaque to clients: the base64url of the ID the previous page ended on.
 * Listings are in ID order, so that ID alone says where to resume.
 */
export const encodeSitemapCursor = (id: string): string =>
  Buffer.from(id, 'utf8').toString('base64url');

/**
 * Decodes a cursor this API issued. Only the canonical encoding decodes, so
 * raw IDs and tampered strings are `VALIDATION_FAILED` instead of listing from
 * a random spot.
 */
export const decodeSitemapCursor = (cursor: string): string => {
  const id = Buffer.from(cursor, 'base64url').toString('utf8');
  if (id.length === 0 || id.length > MAX_ID_LENGTH) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  if (encodeSitemapCursor(id) !== cursor) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  return id;
};
