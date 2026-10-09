import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import {
  type AudioProgress,
  audioProgressOf,
  progressUrlOf,
} from './audio-progress.js';

// The RapidAPI service the legacy app downloaded YouTube audio through (ADR
// 0004). It converts the video to MP3 on its side, which keeps the YouTube
// breakage out of this process. The only code that calls it: features depend
// on this class, so tests replace it at this boundary.
const RAPIDAPI_HOST = 'youtube-info-download-api.p.rapidapi.com';
const CONVERT_URL = `https://${RAPIDAPI_HOST}/ajax/download.php`;

// The same request as the legacy service: the video's audio as a 128 kbps MP3.
const CONVERT_PARAMS = {
  format: 'mp3',
  add_info: '0',
  audio_quality: '128',
  allow_extended_duration: 'false',
  no_merge: 'true',
  audio_language: 'en',
} as const;

const REQUEST_TIMEOUT_MS = 15_000;
const FILE_TIMEOUT_MS = 2 * 60_000;
// A 15-minute MP3 at 128 kbps is about 15 MB; the cap is far above any video
// the Processing accepts, and stops a runaway answer from filling the memory.
const MAX_FILE_BYTES = 64 * 1024 * 1024;

@Injectable()
export class AudioDownloadClient {
  constructor(@Inject(ENV) private readonly env: Env) {
    // Checked when the client is built, so a production deploy without the key
    // never starts. The env schema keeps the key optional for the other
    // configurations (see env.ts).
    if (env.NODE_ENV === 'production' && env.RAPIDAPI_API_KEY === undefined) {
      throw new Error('RAPIDAPI_API_KEY is required in production');
    }
  }

  /** Asks the service to convert the video's audio; answers the progress URL to poll. */
  async requestConversion(videoId: string): Promise<string> {
    const response = await fetch(conversionUrl(videoId), {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': this.apiKey(),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return progressUrlOf(await readJson(response));
  }

  /** The conversion's state at its progress URL. */
  async checkConversion(progressUrl: string): Promise<AudioProgress> {
    const response = await fetch(progressUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return audioProgressOf(await readJson(response));
  }

  /** The converted MP3, from the download URL a finished conversion names. */
  async downloadMp3(url: string): Promise<Uint8Array> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`The MP3 download answered HTTP ${response.status}`);
    }
    if (Number(response.headers.get('content-length')) > MAX_FILE_BYTES) {
      await response.body?.cancel();
      throw new Error('The MP3 is larger than the accepted size');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_BYTES) {
      throw new Error('The MP3 is larger than the accepted size');
    }
    return bytes;
  }

  private apiKey(): string {
    if (this.env.RAPIDAPI_API_KEY === undefined) {
      throw new Error('RAPIDAPI_API_KEY is not set');
    }
    return this.env.RAPIDAPI_API_KEY;
  }
}

const conversionUrl = (videoId: string): string => {
  const params = new URLSearchParams({
    ...CONVERT_PARAMS,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  });
  return `${CONVERT_URL}?${params}`;
};

/** The JSON body of a successful answer; any other status is an error. */
const readJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`RapidAPI answered HTTP ${response.status}`);
  }
  return response.json();
};
