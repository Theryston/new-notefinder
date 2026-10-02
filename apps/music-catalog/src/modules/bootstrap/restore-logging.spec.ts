import type { CatalogDataset } from '@notefinder/contracts';
import { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import { createLogger } from '../../logger.js';
import type { BootstrapRepository } from './bootstrap.repository.js';
import {
  type ResolveArchiveTotalBytes,
  RestoreService,
  restoreServiceDeps,
} from './restore.service.js';

type LoggedCall = {
  message: string;
  fields: Record<string, unknown>;
};

const capturingLogger = () => {
  const calls: LoggedCall[] = [];
  const logger = createLogger({
    name: 'restore-logging-spec',
    json: true,
    out: (line) => {
      calls.push({
        message: (JSON.parse(line) as { message: string }).message,
        fields: JSON.parse(line) as Record<string, unknown>,
      });
    },
    err: () => undefined,
  });
  return { logger, calls };
};

const stubRepository = () =>
  ({
    getState: async () => undefined,
    beginRestore: async () => undefined,
    finishRestore: async () => undefined,
    clearMusicBrainz: async () => undefined,
  }) as unknown as BootstrapRepository;

const BASE_URL = 'https://data.metabrainz.org/pub/musicbrainz/data';

const runRestore = async (
  dataset: CatalogDataset,
  resolveTotalBytes?: ResolveArchiveTotalBytes,
): Promise<LoggedCall[]> => {
  const { logger, calls } = capturingLogger();
  const restore = new RestoreService(
    restoreServiceDeps({
      repository: stubRepository(),
      mbslave: new MbslaveClient(async () => undefined),
      logger,
      baseUrl: BASE_URL,
      dataset,
      resolveUrls: async (baseUrl) => [
        `${baseUrl}/fullexport/20260930-002222/mbdump.tar.bz2`,
        `${baseUrl}/fullexport/20260930-002222/mbdump-derived.tar.bz2`,
      ],
      seedTiny: async () => 300,
      ...(resolveTotalBytes === undefined ? {} : { resolveTotalBytes }),
    }),
  );
  await restore.run();
  return calls;
};

const byMessage = (
  calls: LoggedCall[],
  message: string,
): Record<string, unknown> | undefined =>
  calls.find((call) => call.message === message)?.fields;

describe('RestoreService logging', () => {
  it('logs the resolved LATEST, archives and phase timings in full mode', async () => {
    const calls = await runRestore('full');

    const dumpFields = byMessage(calls, 'Restoring the MusicBrainz dump');
    expect(dumpFields).toMatchObject({
      dataset: 'full',
      baseUrl: BASE_URL,
      latest: '20260930-002222',
      archives: 2,
      urls: [
        `${BASE_URL}/fullexport/20260930-002222/mbdump.tar.bz2`,
        `${BASE_URL}/fullexport/20260930-002222/mbdump-derived.tar.bz2`,
      ],
    });
    expect(byMessage(calls, 'Restore schema creation started')).toMatchObject({
      dataset: 'full',
    });
    expect(byMessage(calls, 'Restore schema creation finished')).toMatchObject({
      dataset: 'full',
    });
    expect(
      (byMessage(calls, 'Restore schema creation finished')
        ?.durationMs as number) >= 0,
    ).toBe(true);
    expect(byMessage(calls, 'Restore import started')).toMatchObject({
      dataset: 'full',
      archives: 2,
    });
    expect(byMessage(calls, 'Restore import finished')).toMatchObject({
      dataset: 'full',
      archives: 2,
    });
    const finished = byMessage(calls, 'Restore finished');
    expect(finished).toMatchObject({ dataset: 'full' });
    expect(typeof finished?.durationMs).toBe('number');
  });

  it('logs the seeded recording count in tiny mode, without a dump download', async () => {
    const calls = await runRestore('tiny');

    expect(byMessage(calls, 'Restoring the MusicBrainz dump')).toBeUndefined();
    expect(byMessage(calls, 'Restore import started')).toBeUndefined();
    expect(byMessage(calls, 'Seeding the tiny catalog')).toMatchObject({
      dataset: 'tiny',
    });
    expect(byMessage(calls, 'Tiny catalog seeded')).toMatchObject({
      dataset: 'tiny',
      recordings: 300,
    });
    expect(byMessage(calls, 'Restore finished')).toMatchObject({
      dataset: 'tiny',
    });
  });

  it('logs the total bytes before the import when the lookup succeeds', async () => {
    const calls = await runRestore('full', async () => 362_835_168);

    expect(byMessage(calls, 'Restoring the MusicBrainz dump')).toMatchObject({
      archives: 2,
      totalBytes: 362_835_168,
    });
    expect(byMessage(calls, 'Restore import started')).toMatchObject({
      totalBytes: 362_835_168,
    });
  });

  it('omits the total instead of failing when the lookup throws', async () => {
    const calls = await runRestore('full', async () => {
      throw new Error('HEAD timed out');
    });

    const dump = byMessage(calls, 'Restoring the MusicBrainz dump');
    expect(dump).toMatchObject({ archives: 2 });
    expect('totalBytes' in (dump ?? {})).toBe(false);
  });
});
