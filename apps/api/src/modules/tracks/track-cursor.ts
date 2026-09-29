import { z } from 'zod';
import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';

/**
 * Position of a track in the catalog order (`score desc, createdAt desc,
 * id desc`). `createdAt` is Postgres' own text form of the timestamp, since
 * a JS `Date` would drop its microseconds and skip or repeat rows.
 */
export type TrackKey = { score: number; createdAt: string; id: string };

// `timestamptz::text` with the default ISO DateStyle.
const POSTGRES_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;

const trackKeySchema = z.object({
  score: z.number().int(),
  createdAt: z.string().regex(POSTGRES_TIMESTAMP),
  id: z.string().min(1),
});

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The opaque `nextCursor` handed to clients. */
export const encodeTrackCursor = ({ score, createdAt, id }: TrackKey): string =>
  Buffer.from(JSON.stringify({ score, createdAt, id })).toString('base64url');

/**
 * Reads a cursor back.
 *
 * @throws {ZodValidationException} (400 `VALIDATION_FAILED` on `cursor`)
 * when it was not made by {@link encodeTrackCursor}.
 */
export const decodeTrackCursor = (cursor: string): TrackKey => {
  const result = trackKeySchema.safeParse(
    parseJson(Buffer.from(cursor, 'base64url').toString('utf8')),
  );
  if (!result.success) {
    throw new ZodValidationException(
      new z.ZodError([
        { code: 'custom', path: ['cursor'], message: 'Invalid cursor' },
      ]),
      'query',
    );
  }
  return result.data;
};
