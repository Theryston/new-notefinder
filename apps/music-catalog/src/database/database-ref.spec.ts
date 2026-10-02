import type { Logger } from '../logger.js';
import { databaseNameOf, openCutoverDatabase } from './database-ref.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe('databaseNameOf', () => {
  it.each([
    ['postgres://host/music_catalog', 'music_catalog'],
    ['postgres://user:pass@host:5433/next?sslmode=require', 'next'],
  ])('reads the database of %p', (url, name) => {
    expect(databaseNameOf(url)).toBe(name);
  });

  it('names nothing without a database', () => {
    expect(databaseNameOf('postgres://host')).toBeUndefined();
    expect(databaseNameOf('postgres://host/')).toBeUndefined();
  });
});

describe('openCutoverDatabase', () => {
  it('opens the database pool without connecting', () => {
    const db = openCutoverDatabase(
      'postgres://host:5433/music_catalog',
      silentLogger,
    );

    expect(typeof db.select).toBe('function');
  });
});
