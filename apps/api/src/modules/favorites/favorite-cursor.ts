import { z } from 'zod';
import {
  decodeTupleCursor,
  encodeTupleCursor,
} from '../../common/cursor/tuple-cursor.js';
import { AppException } from '../../common/errors/app-exception.js';

/**
 * Where a User's favorites listing resumes: the entry that ends the previous
 * page, newest favorited first. `favoritedAt` is in milliseconds, the precision
 * the listing compares at, and the favorite ID breaks ties, so the order is
 * total.
 */
export type FavoriteCursor = {
  favoritedAt: string;
  favoriteId: string;
};

/** Opaque to clients: the two values, as a canonical tuple cursor. */
export const encodeFavoriteCursor = ({
  favoritedAt,
  favoriteId,
}: FavoriteCursor): string => encodeTupleCursor([favoritedAt, favoriteId]);

/** Decodes a cursor this API issued; anything else is `VALIDATION_FAILED`. */
export const decodeFavoriteCursor = (cursor: string): FavoriteCursor => {
  const [favoritedAt, favoriteId] = decodeTupleCursor(cursor);
  if (!z.iso.datetime().safeParse(favoritedAt).success) {
    throw new AppException('VALIDATION_FAILED', 'Invalid cursor');
  }
  return { favoritedAt, favoriteId };
};
