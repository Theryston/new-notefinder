import {
  decodeTupleCursor,
  encodeTupleCursor,
} from '../../common/cursor/tuple-cursor.js';
import { AppException } from '../../common/errors/app-exception.js';

/**
 * Where a home feed page resumes: the version of the feed the rows come from
 * and the index of the first row of the next page. Pinning the version keeps
 * paging consistent when the feed is regenerated in the middle of a visit.
 */
export type HomeCursor = {
  version: string;
  position: number;
};

const FEED_VERSION_PATTERN = /^[0-9a-f]{16}$/;

export const encodeHomeCursor = ({ version, position }: HomeCursor): string =>
  encodeTupleCursor([version, String(position)]);

/** Decodes a cursor this API issued; anything else is `VALIDATION_FAILED`. */
export const decodeHomeCursor = (cursor: string): HomeCursor => {
  const [version, positionText] = decodeTupleCursor(cursor);
  // The version is a hash this API issued (see home-feed-builder), so anything
  // else is refused before it is ever used as a key.
  if (!FEED_VERSION_PATTERN.test(version)) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  const position = Number(positionText);
  // Only the canonical form of a non-negative integer is accepted, so a
  // hand-made cursor can't land on an arbitrary row.
  if (
    !Number.isSafeInteger(position) ||
    position < 0 ||
    String(position) !== positionText
  ) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  return { version, position };
};
