import { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import { createLogger } from '../../logger.js';
import type { BootstrapRepository } from './bootstrap.repository.js';
import { RestoreService, restoreServiceDeps } from './restore.service.js';

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

describe('RestoreService logging', () => {
  it('logs the resolved LATEST, archives and phase timings', async () => {
    const { logger, calls } = capturingLogger();
    const mbslave = new MbslaveClient(async () => undefined);
    const baseUrl = 'https://data.metabrainz.org/pub/musicbrainz/data';
    const restore = new RestoreService(
      restoreServiceDeps({
        repository: stubRepository(),
        mbslave,
        logger,
        baseUrl,
        dataset: 'sample',
        resolveUrls: async () => [
          `${baseUrl}/sample/20260901-000002/mbdump-sample.tar.xz`,
        ],
      }),
    );

    await expect(restore.run()).resolves.toBe('restored');

    const byMessage = (message: string): Record<string, unknown> | undefined =>
      calls.find((call) => call.message === message)?.fields;
    const dumpFields = byMessage('Restoring the MusicBrainz dump');
    expect(dumpFields).toMatchObject({
      dataset: 'sample',
      baseUrl,
      latest: '20260901-000002',
      archives: 1,
      urls: [`${baseUrl}/sample/20260901-000002/mbdump-sample.tar.xz`],
    });
    expect(byMessage('Restore schema creation started')).toMatchObject({
      dataset: 'sample',
    });
    expect(byMessage('Restore schema creation finished')).toMatchObject({
      dataset: 'sample',
    });
    expect(
      (byMessage('Restore schema creation finished')?.durationMs as number) >=
        0,
    ).toBe(true);
    expect(byMessage('Restore import started')).toMatchObject({
      dataset: 'sample',
      archives: 1,
    });
    expect(byMessage('Restore import finished')).toMatchObject({
      dataset: 'sample',
      archives: 1,
    });
    const finished = byMessage('Restore finished');
    expect(finished).toMatchObject({ dataset: 'sample' });
    expect(typeof finished?.durationMs).toBe('number');
    expect(typeof finished?.initMs).toBe('number');
    expect(typeof finished?.importMs).toBe('number');
  });
});
