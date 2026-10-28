import type { BootstrapPhase } from '@vozzify/contracts';
import { CatalogError } from '../../errors/catalog-error.js';
import type { Logger } from '../../logger.js';

export type SearchReadinessOptions = {
  readPhase: (shouldContinue: () => boolean) => Promise<BootstrapPhase>;
  refreshIntervalMs: number;
  logger: Logger;
};

/** Keeps the first-import gate out of the search request path. */
export class SearchReadiness {
  private phase: BootstrapPhase = 'restoring';
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshInFlight: Promise<void> | undefined;
  private stopped = false;

  constructor(private readonly options: SearchReadinessOptions) {}

  get currentPhase(): BootstrapPhase {
    return this.phase;
  }

  /** Loads persisted readiness before searches can be served. */
  async start(): Promise<void> {
    this.phase = await this.options.readPhase(() => !this.stopped);
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

  /** Stops future polling and prevents an in-flight refresh from adopting. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.refreshInFlight !== undefined) return this.refreshInFlight;

    this.refreshInFlight = this.options
      .readPhase(() => !this.stopped)
      .then((phase) => {
        if (this.stopped) return;
        // Cutover can expose the replacement copy while its worker finishes
        // indexing. The already-serving catalog stays searchable meanwhile.
        if (this.phase !== 'ready' || phase === 'ready') {
          this.phase = phase;
        }
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
