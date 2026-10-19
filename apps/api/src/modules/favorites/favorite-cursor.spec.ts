import { AppException } from '../../common/errors/app-exception.js';
import {
  decodeFavoriteCursor,
  encodeFavoriteCursor,
} from './favorite-cursor.js';

const cursor = {
  favoritedAt: '2026-01-02T03:04:05.123Z',
  favoriteId: 'fav-1',
};

describe('favorite cursor', () => {
  it('decodes the cursor it encoded', () => {
    expect(decodeFavoriteCursor(encodeFavoriteCursor(cursor))).toEqual(cursor);
  });

  it.each([
    ['a raw favorite ID', 'fav-1'],
    ['a non-JSON payload', Buffer.from('nope', 'utf8').toString('base64url')],
    [
      'a tuple with a bad date',
      Buffer.from(JSON.stringify(['yesterday', 'fav-1'])).toString('base64url'),
    ],
    [
      'a tuple with extra values',
      Buffer.from(
        JSON.stringify([cursor.favoritedAt, 'fav-1', 'extra']),
      ).toString('base64url'),
    ],
    [
      'a valid tuple with a trailing space in its JSON',
      Buffer.from(
        `${JSON.stringify([cursor.favoritedAt, 'fav-1'])} `,
        'utf8',
      ).toString('base64url'),
    ],
  ])('refuses %s with VALIDATION_FAILED', (_label, raw) => {
    let caught: unknown;
    try {
      decodeFavoriteCursor(raw);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppException);
    expect(caught).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
