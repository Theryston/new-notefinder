import { encodeTupleCursor } from '../../common/cursor/tuple-cursor.js';
import { AppException } from '../../common/errors/app-exception.js';
import { decodeHomeCursor, encodeHomeCursor } from './home-cursor.js';

const VERSION = 'a1b2c3d4e5f60718';

const errorOf = (cursor: string): unknown => {
  try {
    decodeHomeCursor(cursor);
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('home cursor', () => {
  it('round-trips the feed version and the position', () => {
    const cursor = encodeHomeCursor({ version: VERSION, position: 6 });
    expect(decodeHomeCursor(cursor)).toEqual({ version: VERSION, position: 6 });
  });

  it('is opaque: it does not show the version in clear text', () => {
    expect(encodeHomeCursor({ version: VERSION, position: 6 })).not.toContain(
      VERSION,
    );
  });

  it.each([
    ['not base64 JSON', 'not a cursor!'],
    ['a position that is not a number', encodeTupleCursor([VERSION, 'six'])],
    ['a negative position', encodeTupleCursor([VERSION, '-1'])],
    ['a position with leading zeros', encodeTupleCursor([VERSION, '06'])],
    ['a fractional position', encodeTupleCursor([VERSION, '1.5'])],
    ['a version that is not a feed hash', encodeTupleCursor(['v1', '6'])],
    [
      'a version that carries a key separator',
      encodeTupleCursor(['home:public:current', '6']),
    ],
  ])('refuses %s as VALIDATION_FAILED', (_, cursor) => {
    const error = errorOf(cursor);
    expect(error).toBeInstanceOf(AppException);
    expect(error).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
