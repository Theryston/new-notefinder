import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';

// The ffmpeg binary that converts the downloaded audio (ADR 0004). It is the
// only code that runs ffmpeg: features depend on this class, so tests replace
// it at this boundary.
const DEFAULT_FFMPEG_PATH = 'ffmpeg';
// A conversion of a 15-minute track takes seconds; a hung process is killed.
const CONVERSION_TIMEOUT_MS = 2 * 60_000;
// The end of ffmpeg's log is where its error is.
const STDERR_TAIL_CHARS = 2_000;

@Injectable()
export class FfmpegClient {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * Converts an MP3 to WAV with the parameters of the legacy service: the
   * audio only, as 16-bit PCM. The files live in a temporary directory that is
   * removed whatever the outcome.
   */
  async convertMp3ToWav(mp3: Uint8Array): Promise<Uint8Array> {
    const dir = await mkdtemp(join(tmpdir(), 'notefinder-audio-'));
    try {
      const input = join(dir, 'music.mp3');
      const output = join(dir, 'music.wav');
      await writeFile(input, mp3);
      await this.run([
        '-y',
        '-i',
        input,
        '-vn',
        '-acodec',
        'pcm_s16le',
        output,
      ]);
      return new Uint8Array(await readFile(output));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.env.FFMPEG_PATH ?? DEFAULT_FFMPEG_PATH, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        signal: AbortSignal.timeout(CONVERSION_TIMEOUT_MS),
      });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk}`.slice(-STDERR_TAIL_CHARS);
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      });
    });
  }
}
