import type { CatalogDataset } from '@notefinder/contracts';
import type { MbslaveClient } from '../../integrations/mbslave/mbslave-client.js';
import type { Logger } from '../../logger.js';
import type { BootstrapRepository } from './bootstrap.repository.js';
import {
  latestFromArchiveUrls,
  type ResolveDumpUrls,
  resolveLatestDumpUrls,
} from './dump-urls.js';
import { planRestore } from './restore-plan.js';

export type RestoreOutcome = 'restored' | 'skipped';

/**
 * Sums the archive sizes for the pre-import log. Best effort: production
 * wires the `HEAD` lookup, while the default skips it (no extra requests),
 * and a missing total is omitted from the log, never a restore failure.
 */
export type ResolveArchiveTotalBytes = (
  urls: readonly string[],
) => Promise<number | undefined>;

/**
 * Seeds the `tiny` dataset (no downloads): the schema scripts already ran
 * through `init --empty`, so this writes the deterministic Recordings.
 */
export type SeedTinyCatalog = () => Promise<number>;

export type RestoreServiceDeps = {
  repository: BootstrapRepository;
  mbslave: MbslaveClient;
  resolveUrls: ResolveDumpUrls;
  resolveTotalBytes: ResolveArchiveTotalBytes;
  seedTiny: SeedTinyCatalog;
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
    seedTiny: SeedTinyCatalog;
    logger: Logger;
  },
): RestoreServiceDeps => ({
  resolveUrls: resolveLatestDumpUrls,
  resolveTotalBytes: async () => undefined,
  baseUrl: 'https://data.metabrainz.org/pub/musicbrainz/data',
  dataset: 'tiny',
  ...overrides,
});

export class RestoreService {
  constructor(private readonly deps: RestoreServiceDeps) {}

  /**
   * Runs the first import the mbslave container owns: skips a restore that is
   * already done, redoes an interrupted one from a clean state, and
   * otherwise records `restoring` and lays the dataset down. `full`
   * resolves the dump archives and restores them with `init --empty` +
   * `import`; `tiny` creates the same schema with `init --empty` and seeds
   * a few hundred deterministic Recordings, downloading nothing. A failure
   * leaves `restoring` behind, so the next start redoes it; `ready` is the
   * worker's to record, never this one's.
   *
   * Handoff for issue #61 (change triggers and the outbox): the worker
   * installs the triggers after this records `restored` and before it
   * indexes, because mbslave applies the import with replication triggers
   * disabled. Nothing trigger- or outbox-shaped is created here.
   */
  async run(): Promise<RestoreOutcome> {
    const { repository, dataset, logger } = this.deps;
    const startedAt = Date.now();
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
      logger.info('Interrupted restore detected, starting from a clean state', {
        dataset,
      });
      await repository.clearMusicBrainz();
    }
    await repository.beginRestore(dataset);
    if (dataset === 'tiny') {
      await this.runSeed(startedAt);
    } else {
      await this.runImport();
    }
    await repository.finishRestore();
    logger.info('Restore finished', {
      dataset,
      durationMs: Date.now() - startedAt,
    });
    return 'restored';
  }

  // `tiny`: the schema scripts ran through `init --empty`, then the seed
  // writes the deterministic Recordings. No network, megabytes of disk.
  private async runSeed(startedAt: number): Promise<void> {
    const { dataset, logger } = this.deps;
    await this.runInitEmpty();
    logger.info('Seeding the tiny catalog', { dataset });
    const recordings = await this.deps.seedTiny();
    logger.info('Tiny catalog seeded', {
      dataset,
      recordings,
      durationMs: Date.now() - startedAt,
    });
  }

  // `full`: resolves the dump archives, then `init --empty` + `import`.
  // Per-archive completion is not logged because mbslave's output is
  // opaque; its stderr streams live to the log instead (see
  // `MbslaveStderrLine`).
  private async runImport(): Promise<void> {
    const { dataset, logger } = this.deps;
    const urls = await this.deps.resolveUrls(this.deps.baseUrl);
    const totalBytes = await this.totalBytesOf(urls);
    logger.info('Restoring the MusicBrainz dump', {
      dataset,
      baseUrl: this.deps.baseUrl,
      latest: latestFromArchiveUrls(urls),
      archives: urls.length,
      urls,
      totalBytes,
    });
    await this.runInitEmpty();
    const importStartedAt = Date.now();
    logger.info('Restore import started', {
      dataset,
      archives: urls.length,
      totalBytes,
    });
    await this.deps.mbslave.importArchives(urls);
    const importMs = Date.now() - importStartedAt;
    logger.info('Restore import finished', {
      dataset,
      archives: urls.length,
      totalBytes,
      durationMs: importMs,
    });
  }

  // Creates the empty MusicBrainz schema with start/finish logs, shared by
  // both datasets: `init --empty` is not idempotent, so it only ever runs
  // on an empty database or right after clearing it.
  private async runInitEmpty(): Promise<void> {
    const { dataset, logger } = this.deps;
    const initStartedAt = Date.now();
    logger.info('Restore schema creation started', { dataset });
    await this.deps.mbslave.initEmpty();
    logger.info('Restore schema creation finished', {
      dataset,
      durationMs: Date.now() - initStartedAt,
    });
  }

  // The `HEAD` sizes are best-effort logging: a missing total is omitted,
  // never a restore failure.
  private async totalBytesOf(
    urls: readonly string[],
  ): Promise<number | undefined> {
    try {
      return await this.deps.resolveTotalBytes(urls);
    } catch {
      return undefined;
    }
  }
}
