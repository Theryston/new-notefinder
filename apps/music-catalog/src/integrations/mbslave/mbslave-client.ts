import { spawn as nodeSpawn } from 'node:child_process';

/**
 * Runs one `mbslave` command, resolving when it exits zero. Inject the fake
 * in tests; the production implementation spawns the binary of the mbslave
 * container (pinned to git tag `v31.0.1`, installed from git because PyPI is
 * stale), which reads its own `MBSLAVE_*` variables from the environment.
 */
export type MbslaveRun = (args: readonly string[]) => Promise<void>;

type SpawnFn = typeof nodeSpawn;

/** Spawns `mbslave` with the given arguments, inheriting the environment. */
export const createProcessMbslaveRun = (
  spawnImpl: SpawnFn = nodeSpawn,
): MbslaveRun => {
  const stderrTailLength = 2000;
  return (args) =>
    new Promise<void>((resolve, reject) => {
      const child = spawnImpl('mbslave', [...args], {
        stdio: ['ignore', 'inherit', 'pipe'],
      });
      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += String(chunk);
      });
      child.on('error', (error) => {
        reject(
          new Error(`Could not start mbslave ${args[0]}: ${error.message}`),
        );
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        const tail = stderr.slice(-stderrTailLength).trim();
        reject(
          new Error(
            `mbslave ${args[0] ?? ''} failed (exit ${String(code)})${tail === '' ? '' : `: ${tail}`}`,
          ),
        );
      });
    });
};

export class MbslaveClient {
  constructor(private readonly run: MbslaveRun) {}

  /**
   * Creates the empty MusicBrainz schema (tables, keys, indexes, functions).
   * Not idempotent: running it twice fails, so the restore only calls it on
   * an empty database or right after clearing it.
   */
  async initEmpty(): Promise<void> {
    await this.run(['init', '--empty']);
  }

  /**
   * Streams the dump archives into the empty schema. Plain `init` hard-codes
   * the full-export mirror and cannot load the sample, so both datasets go
   * through `import` with explicit URLs (one `tar.xz` for the sample, core
   * plus derived `tar.bz2` for the full export, no edit history).
   */
  async importArchives(urls: readonly string[]): Promise<void> {
    await this.run(['import', ...urls]);
  }
}
