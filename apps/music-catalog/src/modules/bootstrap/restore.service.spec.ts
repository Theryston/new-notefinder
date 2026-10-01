import { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import { createLogger, type Logger } from '../../logger.js';
import type {
  BootstrapRepository,
  BootstrapState,
} from './bootstrap.repository.js';
import {
  RestoreService,
  type RestoreServiceDeps,
  restoreServiceDeps,
} from './restore.service.js';

// Silent in tests: the specs assert the outcome, not the log lines.
const silentLogger: Logger = createLogger({
  name: 'restore-spec',
  json: true,
  out: () => undefined,
  err: () => undefined,
});

type RepositoryStub = {
  calls: string[];
  repository: BootstrapRepository;
};

const stubRepository = (state: BootstrapState | undefined): RepositoryStub => {
  const calls: string[] = [];
  let current = state;
  const repository = {
    getState: async () => {
      calls.push('getState');
      return current;
    },
    advance: async () => {
      calls.push('advance');
    },
    beginRestore: async () => {
      calls.push('beginRestore');
    },
    finishRestore: async () => {
      calls.push('finishRestore');
    },
    clearMusicBrainz: async () => {
      calls.push('clearMusicBrainz');
      current = undefined;
    },
    // The private database handle cannot be stubbed: the cast below is the
    // same one the other service specs use for their mocked repositories.
  } as unknown as BootstrapRepository;
  return { calls, repository };
};

const stubMbslave = (failOn?: 'init' | 'import') => {
  const calls: string[][] = [];
  const mbslave = new MbslaveClient(async (args) => {
    calls.push([...args]);
    if (failOn === 'init' && args[0] === 'init') {
      throw new Error('mbslave init failed (exit 1)');
    }
    if (failOn === 'import' && args[0] === 'import') {
      throw new Error('mbslave import failed (exit 1)');
    }
  });
  return { mbslave, calls };
};

const archiveOf = (baseUrl: string): string[] => [`${baseUrl}/archive`];

const service = (
  overrides: Partial<RestoreServiceDeps> & {
    repository: BootstrapRepository;
    mbslave: MbslaveClient;
  },
): RestoreService =>
  new RestoreService(
    restoreServiceDeps({
      logger: silentLogger,
      // A stub, so these stay unit tests: resolving the real LATEST file
      // over HTTP is covered by dump-urls.spec.ts and the e2e suite.
      resolveUrls: async (baseUrl) => archiveOf(baseUrl),
      ...overrides,
    }),
  );

describe('RestoreService', () => {
  it('restores an empty database: restoring, then init, import and restored', async () => {
    const repo = stubRepository(undefined);
    const { mbslave, calls } = stubMbslave();
    const restore = service({
      repository: repo.repository,
      mbslave,
    });

    await expect(restore.run()).resolves.toBe('restored');

    expect(repo.calls).toEqual(['getState', 'beginRestore', 'finishRestore']);
    expect(calls).toEqual([
      ['init', '--empty'],
      ['import', 'https://data.metabrainz.org/pub/musicbrainz/data/archive'],
    ]);
  });

  it('resolves the configured dataset from the configured base URL', async () => {
    const repo = stubRepository(undefined);
    const { mbslave, calls } = stubMbslave();
    const seen: Array<[string, string]> = [];
    const restore = service({
      repository: repo.repository,
      mbslave,
      baseUrl: 'http://fake:8000/data',
      dataset: 'full',
      resolveUrls: async (baseUrl, dataset) => {
        seen.push([baseUrl, dataset]);
        return archiveOf(baseUrl);
      },
    });

    await restore.run();

    expect(seen).toEqual([['http://fake:8000/data', 'full']]);
    expect(calls[1]).toEqual(['import', 'http://fake:8000/data/archive']);
  });

  it('skips a second start without touching mbslave or the database row', async () => {
    const repo = stubRepository({ phase: 'restored', dataset: 'sample' });
    const { mbslave, calls } = stubMbslave();
    const restore = service({ repository: repo.repository, mbslave });

    await expect(restore.run()).resolves.toBe('skipped');

    expect(repo.calls).toEqual(['getState']);
    expect(calls).toEqual([]);
  });

  it('redoes an interrupted restore from a clean state', async () => {
    const repo = stubRepository({ phase: 'restoring', dataset: 'sample' });
    const { mbslave, calls } = stubMbslave();
    const restore = service({ repository: repo.repository, mbslave });

    await expect(restore.run()).resolves.toBe('restored');

    expect(repo.calls).toEqual([
      'getState',
      'clearMusicBrainz',
      'beginRestore',
      'finishRestore',
    ]);
    expect(calls).toEqual([
      ['init', '--empty'],
      ['import', expect.any(String)],
    ]);
  });

  it('refuses to switch the dataset of a catalog that is already restored', async () => {
    const repo = stubRepository({ phase: 'ready', dataset: 'sample' });
    const { mbslave, calls } = stubMbslave();
    const restore = service({
      repository: repo.repository,
      mbslave,
      dataset: 'full',
    });

    await expect(restore.run()).rejects.toThrow(/another dataset/);

    expect(repo.calls).toEqual(['getState']);
    expect(calls).toEqual([]);
  });

  it('leaves restoring behind when the import fails, so the next start redoes it', async () => {
    const repo = stubRepository(undefined);
    const { mbslave } = stubMbslave('import');
    const restore = service({ repository: repo.repository, mbslave });

    await expect(restore.run()).rejects.toThrow('mbslave import failed');

    expect(repo.calls).toEqual(['getState', 'beginRestore']);
  });

  it('leaves restoring behind when the schema creation fails', async () => {
    const repo = stubRepository(undefined);
    const { mbslave } = stubMbslave('init');
    const restore = service({ repository: repo.repository, mbslave });

    await expect(restore.run()).rejects.toThrow('mbslave init failed');

    expect(repo.calls).toEqual(['getState', 'beginRestore']);
  });
});
