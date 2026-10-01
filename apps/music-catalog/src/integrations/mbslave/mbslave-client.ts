import { spawn as nodeSpawn } from 'node:child_process';

/**
 * Runs one `mbslave` command, resolving when it exits zero. Inject the fake
 * in tests; the production implementation spawns the binary of the mbslave
 * container (pinned to git tag `v31.0.1`, installed from git because PyPI is
 * stale), which reads its own `MBSLAVE_*` variables from the environment.
 */
export type MbslaveRun = (args: readonly string[]) => Promise<void>;

/**
 * One complete `stderr` line from the `mbslave` child, with the command that
 * produced it. The restore logs these live so a long import is greppable;
 * failures still carry the tail in the rejection below.
 */
export type MbslaveStderrLine = (line: string, args: readonly string[]) => void;

type SpawnFn = typeof nodeSpawn;

type StderrRecorder = {
  push: (chunk: string) => void;
  flush: () => void;
  text: () => string;
};

const createStderrRecorder = (
  args: readonly string[],
  onStderrLine?: MbslaveStderrLine,
): StderrRecorder => {
  let text = '';
  let pending = '';
  const emit = (line: string): void => {
    const trimmed = line.replace(/\r$/, '');
    if (trimmed.length === 0) {
      return;
    }
    onStderrLine?.(trimmed, args);
  };
  return {
    push: (chunk: string) => {
      text += chunk;
      pending += chunk;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const part of parts) {
        emit(part);
      }
    },
    flush: () => {
      if (pending.trim().length > 0) {
        emit(pending);
      }
      pending = '';
    },
    text: () => text,
  };
};

/**
 * Spawns `mbslave` with the given arguments, inheriting the environment.
 * `onStderrLine` sees every complete `stderr` line as it arrives
 * (line-buffered, blank lines skipped); the rejection still carries the last
 * 2000 characters for the restore log.
 */
export const createProcessMbslaveRun = (
  spawnImpl: SpawnFn = nodeSpawn,
  onStderrLine?: MbslaveStderrLine,
): MbslaveRun => {
  const stderrTailLength = 2000;
  return (args) =>
    new Promise<void>((resolve, reject) => {
      const child = spawnImpl('mbslave', [...args], {
        stdio: ['ignore', 'inherit', 'pipe'],
      });
      const recorder = createStderrRecorder(args, onStderrLine);
      child.stderr?.on('data', (chunk: Buffer) => {
        recorder.push(String(chunk));
      });
      child.on('error', (error) => {
        reject(
          new Error(`Could not start mbslave ${args[0]}: ${error.message}`),
        );
      });
      child.on('close', (code) => {
        recorder.flush();
        if (code === 0) {
          resolve();
          return;
        }
        const tail = recorder.text().slice(-stderrTailLength).trim();
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
