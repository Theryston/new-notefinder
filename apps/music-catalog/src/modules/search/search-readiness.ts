import type { BootstrapPhase } from '@notefinder/contracts';
import { CatalogError } from '../../errors/catalog-error.js';
import type { Logger } from '../../logger.js';

export type SearchReadinessOptions = {
  readPhase: () => Promise<BootstrapPhase>;
  refreshIntervalMs: number;
  logger: Logger;
};

/** Keeps the first-import gate out of the search request path. */
export class SearchReadiness {
  private phase: BootstrapPhase = 'restoring';
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshInFlight: Promise<void> | undefined;

  constructor(private readonly options: SearchReadinessOptions) {}

  get currentPhase(): BootstrapPhase {
    return this.phase;
  }

  /** Loads persisted readiness before searches can be served. */
  async start(): Promise<void> {
    this.phase = await this.options.readPhase();
    this.timer ??= setInterval(() => {
      void this.refresh();
    }, this.options.refreshIntervalMs);
    this.timer.unref?.();
  }

  /** Refuses search while the cached first-import phase is not ready. */
  assertReady(): void {
    if (this.phase !== 'ready') {
      throw new CatalogError(
        'CATALOG_NOT_READY',
        `The catalog is still importing (phase: ${this.phase})`,
      );
    }
  }

  /** Stops future polling and waits for the current bounded refresh. */
  async stop(): Promise<void> {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.refreshInFlight;
  }

  private refresh(): Promise<void> {
    if (this.refreshInFlight !== undefined) return this.refreshInFlight;

    this.refreshInFlight = this.options
      .readPhase()
      .then((phase) => {
        this.phase = phase;
      })
      .catch((error: unknown) => {
        this.options.logger.error('Search readiness refresh failed', { error });
      })
      .finally(() => {
        this.refreshInFlight = undefined;
      });
    return this.refreshInFlight;
  }
}
