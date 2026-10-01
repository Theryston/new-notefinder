import { EventEmitter } from 'node:events';
import { createProcessMbslaveRun } from './mbslave-client.js';

type SpawnFn = typeof import('node:child_process').spawn;

const fakeSpawn = (
  chunks: string[],
  exitCode: number | null,
  onSpawn?: () => void,
): { spawn: SpawnFn; child: EventEmitter & { stderr: EventEmitter } } => {
  const child = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter;
  };
  child.stderr = new EventEmitter();
  const spawn = ((command: string, args: string[], options: unknown) => {
    onSpawn?.();
    setImmediate(() => {
      for (const chunk of chunks) {
        child.stderr.emit('data', Buffer.from(chunk));
      }
      child.emit('close', exitCode);
    });
    void command;
    void args;
    void options;
    return child;
  }) as unknown as SpawnFn;
  return { spawn, child };
};

describe('createProcessMbslaveRun stderr streaming', () => {
  it('emits complete lines live and keeps the failure tail', async () => {
    const seen: string[] = [];
    const { spawn } = fakeSpawn(['first line\nsecond', ' half\nthird\n'], 1);
    const run = createProcessMbslaveRun(spawn, (line) => {
      seen.push(line);
    });

    await expect(run(['import', 'https://a/x'])).rejects.toThrow(
      /mbslave import failed \(exit 1\)/,
    );
    expect(seen).toEqual(['first line', 'second half', 'third']);
  });

  it('flushes a final line without a trailing newline on success', async () => {
    const seen: string[] = [];
    const { spawn } = fakeSpawn(['working'], 0);
    const run = createProcessMbslaveRun(spawn, (line) => {
      seen.push(line);
    });

    await expect(run(['init', '--empty'])).resolves.toBeUndefined();
    expect(seen).toEqual(['working']);
  });

  it('skips blank lines and works without a listener', async () => {
    const { spawn } = fakeSpawn(['\n\nboom\n'], 1);
    const run = createProcessMbslaveRun(spawn);

    await expect(run(['import', 'https://a/x'])).rejects.toThrow(': boom');
  });
});
