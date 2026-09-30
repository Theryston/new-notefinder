import { createLogger } from './logger.js';

const NOW = new Date('2026-09-30T12:00:00.000Z');

const setup = (json: boolean) => {
  const out: string[] = [];
  const err: string[] = [];
  const logger = createLogger({
    name: 'server',
    json,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { logger, out, err };
};

describe('createLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('as JSON', () => {
    it('writes one JSON object per line, info to out', () => {
      const { logger, out, err } = setup(true);

      logger.info('listening', { port: 3334 });

      expect(err).toEqual([]);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatch(/\}\n$/);
      expect(JSON.parse(out[0] ?? '')).toEqual({
        level: 'info',
        time: '2026-09-30T12:00:00.000Z',
        name: 'server',
        message: 'listening',
        port: 3334,
      });
    });

    it.each(['warn', 'error'] as const)('sends %s to err', (level) => {
      const { logger, out, err } = setup(true);

      logger[level]('careful');

      expect(out).toEqual([]);
      expect(JSON.parse(err[0] ?? '')).toMatchObject({
        level,
        message: 'careful',
      });
    });

    it('describes an Error field with its name, message and stack', () => {
      const { logger, err } = setup(true);
      const error = new TypeError('bad input');

      logger.error('failed', { error });

      expect(JSON.parse(err[0] ?? '')).toMatchObject({
        error: { name: 'TypeError', message: 'bad input', stack: error.stack },
      });
    });
  });

  describe('as text', () => {
    it('writes the time, level, name, message and fields on one line', () => {
      const { logger, out } = setup(false);

      logger.info('listening', { port: 3334 });

      expect(out).toEqual([
        '2026-09-30T12:00:00.000Z INFO [server] listening {"port":3334}\n',
      ]);
    });

    it('omits the fields when there are none', () => {
      const { logger, err } = setup(false);

      logger.warn('careful');

      expect(err).toEqual(['2026-09-30T12:00:00.000Z WARN [server] careful\n']);
    });
  });
});
