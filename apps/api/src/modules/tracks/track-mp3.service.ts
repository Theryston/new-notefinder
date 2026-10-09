import { Injectable } from '@nestjs/common';
import { FfmpegClient } from '../../integrations/ffmpeg/ffmpeg.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import {
  type Mp3Kind,
  type ProcessingAudioUrls,
  TrackLyricsRepository,
} from './track-lyrics.repository.js';
import type { ProcessingForStep } from './track-processing.repository.js';

const MP3_CONTENT_TYPE = 'audio/mpeg';

/** Where an MP3 is stored: one key per Processing, beside the WAV it converts. */
const mp3KeyOf = (processing: ProcessingForStep, kind: Mp3Kind): string =>
  `${kind === 'music' ? 'track-audio' : 'track-vocals'}/${processing.trackId}/${processing.id}.mp3`;

const mp3UrlOf = (urls: ProcessingAudioUrls, kind: Mp3Kind): string | null =>
  kind === 'music' ? urls.musicMp3Url : urls.vocalsMp3Url;

const wavUrlOf = (
  processing: ProcessingForStep,
  urls: ProcessingAudioUrls,
  kind: Mp3Kind,
): string => {
  const url = kind === 'music' ? urls.musicWavUrl : urls.vocalsWavUrl;
  if (url === null) {
    throw new Error(
      `Processing ${processing.id} has no ${kind} WAV to convert`,
    );
  }
  return url;
};

/** An MP3 as the step has it: its public URL, and its bytes when this run converted it. */
type StoredMp3 = { url: string; bytes?: Uint8Array<ArrayBuffer> };

/**
 * The MP3s of the lyrics step (ADR 0004): the music and the vocals are converted
 * from their WAVs with the legacy parameters, stored publicly, and their URLs
 * saved on the Processing. A run that finds an MP3 already stored converts
 * nothing, so a replayed step does not convert twice.
 */
@Injectable()
export class TrackMp3Service {
  constructor(
    private readonly ffmpeg: FfmpegClient,
    private readonly storage: StorageService,
    private readonly lyrics: TrackLyricsRepository,
  ) {}

  /** Stores the music as MP3. Its bytes are not needed here, so none are read back. */
  async storeMusicMp3(processing: ProcessingForStep): Promise<void> {
    await this.store(processing, 'music');
  }

  /** Stores the vocals as MP3 and answers their bytes, which the transcription reads. */
  async storeVocalsMp3(
    processing: ProcessingForStep,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const stored = await this.store(processing, 'vocals');
    return stored.bytes ?? this.storage.downloadPublicObject(stored.url);
  }

  /**
   * The MP3 of one kind, stored and saved. A saved URL, or an object already in
   * storage, is kept as it is: only a missing MP3 is converted.
   */
  private async store(
    processing: ProcessingForStep,
    kind: Mp3Kind,
  ): Promise<StoredMp3> {
    const urls = await this.lyrics.findAudioUrls(processing.id);
    const saved = mp3UrlOf(urls, kind);
    if (saved !== null) {
      return { url: saved };
    }
    const key = mp3KeyOf(processing, kind);
    if (await this.storage.objectExists(key)) {
      return { url: await this.saveUrl(processing.id, kind, key) };
    }
    const wav = await this.storage.downloadPublicObject(
      wavUrlOf(processing, urls, kind),
    );
    const mp3 = await this.ffmpeg.convertWavToMp3(wav);
    await this.storage.putPublicObject({
      key,
      body: mp3,
      contentType: MP3_CONTENT_TYPE,
    });
    return { url: await this.saveUrl(processing.id, kind, key), bytes: mp3 };
  }

  private async saveUrl(
    processingId: string,
    kind: Mp3Kind,
    key: string,
  ): Promise<string> {
    const url = this.storage.publicUrl(key);
    await this.lyrics.saveMp3Url(processingId, kind, url);
    return url;
  }
}
