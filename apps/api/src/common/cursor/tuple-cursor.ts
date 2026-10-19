import { z } from 'zod';
import { AppException } from '../errors/app-exception.js';

const tupleSchema = z.tuple([
  z.string().min(1).max(128),
  z.string().min(1).max(128),
]);

/**
 * Encodes the two values of a keyset cursor. Opaque to clients: a base64url
 * JSON array, so the same page is never resumed from a guessed position.
 */
export const encodeTupleCursor = (values: readonly [string, string]): string =>
  Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');

/**
 * Decodes a cursor this API issued into its two values. Only the canonical
 * encoding decodes, so raw IDs and tampered strings are refused with
 * `VALIDATION_FAILED` instead of silently listing from a random spot.
 */
export const decodeTupleCursor = (cursor: string): [string, string] => {
  const invalid = () => new AppException('VALIDATION_FAILED', 'Invalid cursor');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const tuple = tupleSchema.safeParse(parsed);
  if (!tuple.success) {
    throw invalid();
  }
  const [first, second] = tuple.data;
  if (encodeTupleCursor([first, second]) !== cursor) {
    throw invalid();
  }
  return [first, second];
};
