import { AppException } from '../errors/app-exception.js';
import { decodeSitemapCursor, encodeSitemapCursor } from './sitemap-cursor.js';

describe('sitemap cursor', () => {
  it('decodes back to the ID it encodes', () => {
    expect(decodeSitemapCursor(encodeSitemapCursor('user_abc123'))).toBe(
      'user_abc123',
    );
  });

  it('refuses a raw ID instead of listing from a random spot', () => {
    expect(() => decodeSitemapCursor('user_abc123')).toThrow(AppException);
  });

  it('refuses a cursor that is not in its canonical encoding', () => {
    const padded = `${encodeSitemapCursor('user_abc123')}=`;

    expect(() => decodeSitemapCursor(padded)).toThrow(AppException);
  });
});
