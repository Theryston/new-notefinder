import { readFileSync } from 'node:fs';
import type { AudioProgress } from '../../src/integrations/audio-download/audio-progress.js';

// A one-second MP3 at 128 kbps: the file the RapidAPI service answers with.
const TONE_MP3 = new Uint8Array(
  readFileSync(new URL('../fixtures/tone.mp3', import.meta.url)),
);

/**
 * The RapidAPI audio download, faked at its integration boundary for the e2e
 * specs. A conversion answers "still converting" for `pendingChecks` checks,
 * then it is ready with `mp3` to download. Every call is recorded, so a spec
 * asserts what was asked and what was not.
 */
export class FakeAudioDownload {
  /** The video IDs conversions were requested for. */
  readonly requests: string[] = [];
  /** The progress URLs checked, in order. */
  readonly checks: string[] = [];
  /** The MP3 URLs downloaded. */
  readonly downloads: string[] = [];
  /** Checks that answer "still converting" per conversion; Infinity never finishes. */
  pendingChecks = 0;
  /** The MP3 a download answers; bytes that are not audio make ffmpeg fail. */
  mp3: Uint8Array = TONE_MP3;
  /** When set, every request for a conversion fails with it: RapidAPI is down. */
  requestFailure: Error | undefined;

  /** Back to the answers of a fresh fake, with no calls recorded. */
  reset(): void {
    this.requests.length = 0;
    this.checks.length = 0;
    this.downloads.length = 0;
    this.pendingChecks = 0;
    this.mp3 = TONE_MP3;
    this.requestFailure = undefined;
  }

  async requestConversion(videoId: string): Promise<string> {
    this.requests.push(videoId);
    if (this.requestFailure !== undefined) {
      throw this.requestFailure;
    }
    return `https://rapidapi.test/progress/${videoId}`;
  }

  async checkConversion(progressUrl: string): Promise<AudioProgress> {
    this.checks.push(progressUrl);
    const checksOfThis = this.checks.filter((url) => url === progressUrl);
    if (checksOfThis.length <= this.pendingChecks) {
      return { ready: false };
    }
    return {
      ready: true,
      downloadUrl: `https://rapidapi.test/file/${encodeURIComponent(progressUrl)}`,
    };
  }

  async downloadMp3(url: string): Promise<Uint8Array> {
    this.downloads.push(url);
    return this.mp3;
  }
}
