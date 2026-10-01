import { EventEmitter } from 'node:events';
import { createProcessMbslaveRun, MbslaveClient } from './mbslave-client.js';

describe('MbslaveClient', () => {
  it('creates the empty schema with init --empty', async () => {
    const calls: string[][] = [];
    const client = new MbslaveClient(async (args) => {
      calls.push([...args]);
    });

    await client.initEmpty();

    expect(calls).toEqual([['init', '--empty']]);
  });

  it('imports every archive with one import call', async () => {
    const calls: string[][] = [];
    const client = new MbslaveClient(async (args) => {
      calls.push([...args]);
    });

    await client.importArchives([
      'https://a/mbdump.tar.bz2',
      'https://a/derived.tar.bz2',
    ]);

    expect(calls).toEqual([
      ['import', 'https://a/mbdump.tar.bz2', 'https://a/derived.tar.bz2'],
    ]);
  });

  it('lets a failing command surface to the restore, which stays restoring', async () => {
    const client = new MbslaveClient(async () => {
      throw new Error('mbslave import failed (exit 1): boom');
    });

    await expect(client.importArchives(['https://a/x'])).rejects.toThrow(
      'mbslave import failed',
    );
  });

  it('applies the pending packets with one sync call', async () => {
    const calls: string[][] = [];
    const client = new MbslaveClient(async (args) => {
      calls.push([...args]);
    });

    await client.sync();

    expect(calls).toEqual([['sync']]);
  });

  it('lets a failing sync surface to the replication loop, which restarts', async () => {
    const client = new MbslaveClient(async () => {
      throw new Error('mbslave sync failed (exit 1): boom');
    });

    await expect(client.sync()).rejects.toThrow('mbslave sync failed');
  });
});

describe('createProcessMbslaveRun', () => {
  type SpawnArgs = [command: string, args: string[], options: unknown];

  const spawning = (exitCode: number | null, stderr: string) => {
    const calls: SpawnArgs[] = [];
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
    };
    const stderrStream = new EventEmitter();
    child.stderr = stderrStream;
    const spawn = ((command: string, args: string[], options: unknown) => {
      calls.push([command, args, options]);
      setImmediate(() => {
        if (stderr !== '') {
          stderrStream.emit('data', Buffer.from(stderr));
        }
        child.emit('close', exitCode);
      });
      return child;
    }) as unknown as typeof import('node:child_process').spawn;
    return { spawn, calls };
  };

  it('resolves when mbslave exits zero', async () => {
    const { spawn, calls } = spawning(0, '');

    await expect(
      createProcessMbslaveRun(spawn)(['init', '--empty']),
    ).resolves.toBeUndefined();
    expect(calls[0]?.[0]).toBe('mbslave');
    expect(calls[0]?.[1]).toEqual(['init', '--empty']);
  });

  it('reports the exit code with the end of stderr', async () => {
    const { spawn } = spawning(1, 'traceback\nboom');

    await expect(
      createProcessMbslaveRun(spawn)(['import', 'https://a/x']),
    ).rejects.toThrow('mbslave import failed (exit 1): traceback\nboom');
  });

  it('inherits the environment unless told otherwise', async () => {
    const { spawn, calls } = spawning(0, '');

    await createProcessMbslaveRun(spawn)(['sync']);

    expect(calls[0]?.[2]).toEqual({ stdio: ['ignore', 'inherit', 'pipe'] });
  });

  it('runs with the given environment when one is passed', async () => {
    const { spawn, calls } = spawning(0, '');
    const env = { PATH: '/usr/bin', MBSLAVE_MUSICBRAINZ_TOKEN: 'token' };

    await createProcessMbslaveRun(spawn, undefined, env)(['sync']);

    expect(calls[0]?.[2]).toEqual({
      stdio: ['ignore', 'inherit', 'pipe'],
      env,
    });
  });
});
