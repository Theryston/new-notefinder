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

const runRestore = async (
  resolveTotalBytes?: ResolveArchiveTotalBytes,
): Promise<LoggedCall[]> => {
  const { logger, calls } = capturingLogger();
  const restore = new RestoreService(
    restoreServiceDeps({
      repository: stubRepository(),
      mbslave: new MbslaveClient(async () => undefined),
      logger,
      baseUrl: 'https://data.metabrainz.org/pub/musicbrainz/data',
      dataset: 'sample',
      resolveUrls: async (baseUrl) => [
        `${baseUrl}/sample/20260901-000002/mbdump-sample.tar.xz`,
      ],
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
  it('logs the resolved LATEST, archives and phase timings', async () => {
    const calls = await runRestore();
    const baseUrl = 'https://data.metabrainz.org/pub/musicbrainz/data';

    const dumpFields = byMessage(calls, 'Restoring the MusicBrainz dump');
    expect(dumpFields).toMatchObject({
      dataset: 'sample',
      baseUrl,
      latest: '20260901-000002',
      archives: 1,
      urls: [`${baseUrl}/sample/20260901-000002/mbdump-sample.tar.xz`],
    });
    expect(byMessage(calls, 'Restore schema creation started')).toMatchObject({
      dataset: 'sample',
    });
    expect(byMessage(calls, 'Restore schema creation finished')).toMatchObject({
      dataset: 'sample',
    });
    expect(
      (byMessage(calls, 'Restore schema creation finished')
        ?.durationMs as number) >= 0,
    ).toBe(true);
    expect(byMessage(calls, 'Restore import started')).toMatchObject({
      dataset: 'sample',
      archives: 1,
    });
    expect(byMessage(calls, 'Restore import finished')).toMatchObject({
      dataset: 'sample',
      archives: 1,
    });
    const finished = byMessage(calls, 'Restore finished');
    expect(finished).toMatchObject({ dataset: 'sample' });
    expect(typeof finished?.durationMs).toBe('number');
    expect(typeof finished?.initMs).toBe('number');
    expect(typeof finished?.importMs).toBe('number');
  });

  it('logs the total bytes before the import when the lookup succeeds', async () => {
    const calls = await runRestore(async () => 362_835_168);

    expect(byMessage(calls, 'Restoring the MusicBrainz dump')).toMatchObject({
      archives: 1,
      totalBytes: 362_835_168,
    });
    expect(byMessage(calls, 'Restore import started')).toMatchObject({
      totalBytes: 362_835_168,
    });
  });

  it('omits the total instead of failing when the lookup throws', async () => {
    const calls = await runRestore(async () => {
      throw new Error('HEAD timed out');
    });

    const dump = byMessage(calls, 'Restoring the MusicBrainz dump');
    expect(dump).toMatchObject({ archives: 1 });
    expect('totalBytes' in (dump ?? {})).toBe(false);
  });
});
