export type ReimportPointer =
  | {
      phase: string;
      detail: string | null;
    }
  | undefined;

/**
 * Where the serving copy lives: `configuredUrl`, unless a reimport already
 * flipped the reads to the parallel database. The flip is recorded as
 * `switched` with the new URL in `detail`, so every process adopts it on
 * its next start (and without restarting, on its next `status`).
 *
 * When the configured database is unreachable and a parallel URL is
 * configured, the parallel copy is asked too: after the flip the retired
 * database may be dropped, so only the new copy can answer. It is adopted
 * only when it points at itself, never on a guess: anything else fails the
 * boot fast instead of serving a stale copy.
 */
export const resolveServingDatabaseUrl = async (options: {
  configuredUrl: string;
  reimportUrl?: string;
  readReimportState: (url: string) => Promise<ReimportPointer>;
}): Promise<string> => {
  try {
    const reimport = await options.readReimportState(options.configuredUrl);
    if (reimport?.phase === 'switched' && reimport.detail) {
      return reimport.detail;
    }
    return options.configuredUrl;
  } catch (error) {
    const reimportUrl = options.reimportUrl;
    if (reimportUrl === undefined || reimportUrl === options.configuredUrl) {
      throw error;
    }
    try {
      const next = await options.readReimportState(reimportUrl);
      if (next?.phase === 'switched' && next.detail === reimportUrl) {
        return reimportUrl;
      }
    } catch {
      // The parallel copy cannot answer either: the configured database is
      // what is wrong, so its error is what the boot reports.
    }
    throw error;
  }
};
