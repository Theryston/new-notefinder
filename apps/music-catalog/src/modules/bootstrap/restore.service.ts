import type { CatalogDataset } from '@notefinder/contracts';
import type { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import type { Logger } from '../../logger.js';
import type { BootstrapRepository } from './bootstrap.repository.js';
import { type ResolveDumpUrls, resolveLatestDumpUrls } from './dump-urls.js';
import { planRestore } from './restore-plan.js';

export type RestoreOutcome = 'restored' | 'skipped';

export type RestoreServiceDeps = {
  repository: BootstrapRepository;
  mbslave: MbslaveClient;
  resolveUrls: ResolveDumpUrls;
  /** The `.../data` directory the dumps are published under. */
  baseUrl: string;
  /** The dataset this deployment restores (`CATALOG_DATASET`). */
  dataset: CatalogDataset;
  logger: Logger;
};

export const restoreServiceDeps = (
  overrides: Partial<RestoreServiceDeps> & {
    repository: BootstrapRepository;
    mbslave: MbslaveClient;
    logger: Logger;
  },
): RestoreServiceDeps => ({
  resolveUrls: resolveLatestDumpUrls,
  baseUrl: 'https://data.metabrainz.org/pub/musicbrainz/data',
  dataset: 'sample',
  ...overrides,
});

export class RestoreService {
  constructor(private readonly deps: RestoreServiceDeps) {}

  /**
   * Runs the first import the mbslave container owns: skips a restore that is
   * already done, redoes an interrupted one from a clean state, and
   * otherwise records `restoring`, resolves the dump archives, restores them
   * with `init --empty` + `import` and records `restored`. A failure leaves
   * `restoring` behind, so the next start redoes it; `ready` is the worker's
   * to record, never this one's.
   *
   * Handoff for issue #61 (change triggers and the outbox): the worker
   * installs the triggers after this records `restored` and before it
   * indexes, because mbslave applies the import with replication triggers
   * disabled. Nothing trigger- or outbox-shaped is created here.
   */
  async run(): Promise<RestoreOutcome> {
    const { repository, dataset, logger } = this.deps;
    const plan = planRestore(await repository.getState(), dataset);
    if (plan === 'skip') {
      logger.info('Restore already done, skipping the download', { dataset });
      return 'skipped';
    }
    if (plan === 'dataset-changed') {
      throw new Error(
        `The catalog holds another dataset: refusing to switch to ${dataset} ` +
          '(that would silently re-download gigabytes). Reset the local ' +
          'database first (see apps/music-catalog/AGENTS.md).',
      );
    }
    if (plan === 'redo') {
      logger.info('Interrupted restore detected, starting from a clean state');
      await repository.clearMusicBrainz();
    }
    await repository.beginRestore(dataset);
    const urls = await this.deps.resolveUrls(this.deps.baseUrl, dataset);
    logger.info('Restoring the MusicBrainz dump', {
      dataset,
      archives: urls.length,
    });
    await this.deps.mbslave.initEmpty();
    await this.deps.mbslave.importArchives(urls);
    await repository.finishRestore();
    logger.info('Restore finished', { dataset });
    return 'restored';
  }
}
