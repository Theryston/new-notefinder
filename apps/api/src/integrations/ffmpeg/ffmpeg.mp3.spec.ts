import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { Test, type TestingModule } from '@nestjs/testing';
import { ENV } from '../../config/env.js';
import { FfmpegClient } from './ffmpeg.client.js';

// ffmpeg is replaced at the process boundary: the spec checks the arguments of
// the WAV to MP3 conversion and the output it returns.
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

const spawnMock = vi.mocked(spawn);
const WAV = new Uint8Array([82, 73, 70, 70]);
const MP3 = new Uint8Array([255, 251, 144, 0]);

/** A child process that writes the MP3 to its output and closes with `code`. */
const runningFfmpeg = (code: number) => {
  spawnMock.mockImplementation((_command, args) => {
    const child = new EventEmitter() as ChildProcess & EventEmitter;
    Object.assign(child, { stderr: new EventEmitter() });
    const output = args?.at(-1) ?? '';
    setImmediate(async () => {
      if (code === 0) {
        await writeFile(output, MP3);
      }
      child.emit('close', code);
    });
    return child;
  });
};

describe('FfmpegClient.convertWavToMp3', () => {
  let client: FfmpegClient;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [FfmpegClient, { provide: ENV, useValue: {} }],
    }).compile();
    client = moduleRef.get(FfmpegClient);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('converts with the legacy parameters: the audio only, as an MP3 at VBR quality 2', async () => {
    runningFfmpeg(0);

    await client.convertWavToMp3(WAV);

    const [command, args] = spawnMock.mock.calls[0] ?? [];
    expect(command).toBe('ffmpeg');
    expect(args?.slice(0, 2)).toEqual(['-y', '-i']);
    expect(args?.slice(3)).toEqual([
      '-vn',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '2',
      expect.stringMatching(/audio\.mp3$/),
    ]);
  });

  it('answers the MP3 ffmpeg wrote', async () => {
    runningFfmpeg(0);

    await expect(client.convertWavToMp3(WAV)).resolves.toEqual(MP3);
  });

  it('fails when ffmpeg exits with an error', async () => {
    runningFfmpeg(1);

    await expect(client.convertWavToMp3(WAV)).rejects.toThrow(
      'ffmpeg exited with code 1',
    );
  });
});
