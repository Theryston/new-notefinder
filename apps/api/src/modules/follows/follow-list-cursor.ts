import { z } from 'zod';
import {
  decodeTupleCursor,
  encodeTupleCursor,
} from '../../common/cursor/tuple-cursor.js';
import { AppException } from '../../common/errors/app-exception.js';

/**
 * Where a follow list resumes: the follow that ends the previous page, newest
 * first. `followedAt` is in milliseconds, the precision the list compares at,
 * and the follow's row ID breaks ties, so the order is total.
 */
export type FollowListCursor = {
  followedAt: string;
  followId: string;
};

/** Opaque to clients: the two values, as a canonical tuple cursor. */
export const encodeFollowListCursor = ({
  followedAt,
  followId,
}: FollowListCursor): string => encodeTupleCursor([followedAt, followId]);

/** Decodes a cursor this API issued; anything else is `VALIDATION_FAILED`. */
export const decodeFollowListCursor = (cursor: string): FollowListCursor => {
  const [followedAt, followId] = decodeTupleCursor(cursor);
  if (!z.iso.datetime().safeParse(followedAt).success) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  return { followedAt, followId };
};
