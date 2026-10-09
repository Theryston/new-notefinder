import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { FfmpegClient } from './ffmpeg.client.js';

// ffmpeg is replaced at the process boundary: the spec checks the arguments it
// is run with and what the client does with its files and its exit.
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

const spawnMock = vi.mocked(spawn);
const WAV = new Uint8Array([82, 73, 70, 70]);
const MP3 = new Uint8Array([1, 2, 3]);

/** A child process that writes `output` (or fails) and then closes. */
const runningFfmpeg = (outcome: {
  code?: number;
  stderr?: string;
  error?: Error;
}) => {
  spawnMock.mockImplementation((_command, args) => {
    const child = new EventEmitter() as ChildProcess & EventEmitter;
    Object.assign(child, { stderr: Readable.from([outcome.stderr ?? '']) });
    const output = args?.at(-1) ?? '';
    setImmediate(async () => {
      if (outcome.error !== undefined) {
        child.emit('error', outcome.error);
        return;
      }
      if ((outcome.code ?? 0) === 0) {
        await writeFile(output, WAV);
      }
      child.emit('close', outcome.code ?? 0);
    });
    return child;
  });
};

describe('FfmpegClient', () => {
  let client: FfmpegClient;
  let moduleRef: TestingModule;

  const configure = async (env: Record<string, unknown> = {}) => {
    moduleRef = await Test.createTestingModule({
      providers: [FfmpegClient, { provide: ENV, useValue: env }],
    }).compile();
    client = moduleRef.get(FfmpegClient);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await configure();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('converts with the legacy parameters: the audio only, as 16-bit PCM WAV', async () => {
    runningFfmpeg({});

    await client.convertMp3ToWav(MP3);

    const [command, args] = spawnMock.mock.calls[0] ?? [];
    expect(command).toBe('ffmpeg');
    expect(args?.slice(0, 2)).toEqual(['-y', '-i']);
    expect(args?.slice(3)).toEqual([
      '-vn',
      '-acodec',
      'pcm_s16le',
      expect.stringMatching(/music\.wav$/),
    ]);
  });

  it('runs the binary named by FFMPEG_PATH', async () => {
    await moduleRef.close();
    await configure({ FFMPEG_PATH: '/opt/ffmpeg/bin/ffmpeg' });
    runningFfmpeg({});

    await client.convertMp3ToWav(MP3);

    expect(spawnMock.mock.calls[0]?.[0]).toBe('/opt/ffmpeg/bin/ffmpeg');
  });

  it('answers the WAV ffmpeg wrote', async () => {
    runningFfmpeg({});

    await expect(client.convertMp3ToWav(MP3)).resolves.toEqual(WAV);
  });

  it('removes its temporary directory after a conversion', async () => {
    runningFfmpeg({});

    await client.convertMp3ToWav(MP3);

    const input = spawnMock.mock.calls[0]?.[1]?.[2] ?? '';
    expect(existsSync(dirname(input))).toBe(false);
  });

  it('fails with the exit code and the end of ffmpeg log, and still removes its directory', async () => {
    runningFfmpeg({
      code: 1,
      stderr: 'Invalid data found when processing input',
    });

    await expect(client.convertMp3ToWav(MP3)).rejects.toThrow(
      'ffmpeg exited with code 1: Invalid data found when processing input',
    );
    const input = spawnMock.mock.calls[0]?.[1]?.[2] ?? '';
    expect(existsSync(dirname(input))).toBe(false);
  });

  it('fails when ffmpeg cannot be started', async () => {
    runningFfmpeg({ error: new Error('spawn ffmpeg ENOENT') });

    await expect(client.convertMp3ToWav(MP3)).rejects.toThrow(
      'spawn ffmpeg ENOENT',
    );
  });
});
