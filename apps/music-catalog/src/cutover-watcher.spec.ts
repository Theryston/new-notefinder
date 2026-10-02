import { createCutoverWatcher } from './cutover-watcher.js';
import type { Database } from './database/database.js';
import type { Logger } from './logger.js';

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const setup = (state: { phase: string; detail: string | null } | undefined) => {
  const opened: string[] = [];
  const adopted: Database[] = [];
  const info = vi.fn();
  const watcher = createCutoverWatcher({
    readState: async () =>
      state === undefined
        ? undefined
        : {
            phase: state.phase as 'switched',
            progressPct: null,
            detail: state.detail,
          },
    openDatabase: (url: string) => {
      opened.push(url);
      return { opened: url } as unknown as Database;
    },
    adopt: (db: Database) => {
      adopted.push(db);
    },
    logger: { ...silentLogger, info },
  });
  return { watcher, opened, adopted, info };
};

describe('createCutoverWatcher', () => {
  it('flips the reads to the parallel database after the flip', async () => {
    const { watcher, opened, adopted, info } = setup({
      phase: 'switched',
      detail: 'postgres://host/next',
    });

    await watcher.adoptIfSwitched();

    expect(opened).toEqual(['postgres://host/next']);
    expect(adopted).toHaveLength(1);
    expect(info).toHaveBeenCalledWith('Adopted the reimported copy');
  });

  it('checks once: an adopted process never reads again', async () => {
    const readState = vi.fn(async () => ({
      phase: 'switched' as const,
      progressPct: null,
      detail: 'postgres://host/next',
    }));
    const watcher = createCutoverWatcher({
      readState,
      openDatabase: (url: string) => ({ url }) as unknown as Database,
      adopt: () => undefined,
      logger: silentLogger,
    });

    await watcher.adoptIfSwitched();
    await watcher.adoptIfSwitched();

    expect(readState).toHaveBeenCalledTimes(1);
  });

  it.each([
    { phase: 'indexing', detail: 'postgres://host/next' },
    { phase: 'switched', detail: null },
  ])('leaves the serving copy alone while $phase runs', async (state) => {
    const { watcher, opened, adopted } = setup({
      phase: state.phase,
      detail: state.detail,
    });

    await watcher.adoptIfSwitched();

    expect(opened).toHaveLength(0);
    expect(adopted).toHaveLength(0);
  });

  it('leaves the serving copy alone without a reimport', async () => {
    const { watcher, opened, adopted } = setup(undefined);

    await watcher.adoptIfSwitched();

    expect(opened).toHaveLength(0);
    expect(adopted).toHaveLength(0);
  });
});
