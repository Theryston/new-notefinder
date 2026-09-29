import { ZodValidationException } from '../../common/zod/zod-validation.pipe.js';
import { decodeTrackCursor, encodeTrackCursor } from './track-cursor.js';

const key = {
  score: 42,
  createdAt: '2026-09-29 12:34:56.123456+00',
  id: 'track-1',
};

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const expectInvalid = (cursor: string) => {
  let error: unknown;
  try {
    decodeTrackCursor(cursor);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(ZodValidationException);
  const { zodError, location } = error as ZodValidationException;
  expect(location).toBe('query');
  expect(zodError.issues).toEqual([
    expect.objectContaining({ path: ['cursor'], message: 'Invalid cursor' }),
  ]);
};

describe('track cursor', () => {
  it('round-trips a key, microseconds included', () => {
    const cursor = encodeTrackCursor(key);

    expect(cursor).toMatch(/^[\w-]+$/);
    expect(decodeTrackCursor(cursor)).toEqual(key);
  });

  it('keeps only the key fields', () => {
    const cursor = encodeTrackCursor({ ...key, title: 'x' } as typeof key);

    expect(decodeTrackCursor(cursor)).toEqual(key);
  });

  it.each([
    ['whole-second timestamps', '2026-09-29 12:34:56+00'],
    ['offsets with minutes', '2026-09-29 12:34:56.1-03:30'],
  ])('accepts %s', (_, createdAt) => {
    expect(decodeTrackCursor(encode({ ...key, createdAt }))).toEqual({
      ...key,
      createdAt,
    });
  });

  it.each([
    ['not base64 JSON', 'not-a-cursor'],
    ['JSON that is not an object', encode('hello')],
    ['a missing field', encode({ score: 1, createdAt: key.createdAt })],
    ['a fractional score', encode({ ...key, score: 1.5 })],
    ['an empty id', encode({ ...key, id: '' })],
    ['an ISO timestamp', encode({ ...key, createdAt: '2026-09-29T12:00Z' })],
    [
      'SQL in the timestamp',
      encode({ ...key, createdAt: `${key.createdAt}'` }),
    ],
  ])('refuses %s', (_, cursor) => {
    expectInvalid(cursor);
  });
});
