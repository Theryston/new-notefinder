import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { type Queue } from 'bullmq';
import { FfmpegClient } from '../../integrations/ffmpeg/ffmpeg.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import {
  musicMp3JobId,
  STORE_MUSIC_MP3_JOB,
  type StoreMusicMp3Job,
  TRACK_MP3_QUEUE,
} from './track-mp3.job.js';
import { TrackProcessingRepository } from './track-processing.repository.js';
import type {
  Mp3Kind,
  ProcessingRef,
  StoredAudioUrls,
} from './track-processing-outputs.js';

const MP3_CONTENT_TYPE = 'audio/mpeg';

/** Where each MP3 comes from and lives: its WAV's URL, and its folder beside the WAV's. */
const MP3_OF: Record<
  Mp3Kind,
  {
    folder: string;
    wavUrl: (urls: StoredAudioUrls) => string | null;
    mp3Url: (urls: StoredAudioUrls) => string | null;
  }
> = {
  music: {
    folder: 'track-audio',
    wavUrl: (urls) => urls.musicWavUrl,
    mp3Url: (urls) => urls.musicMp3Url,
  },
  vocals: {
    folder: 'track-vocals',
    wavUrl: (urls) => urls.vocalsWavUrl,
    mp3Url: (urls) => urls.vocalsMp3Url,
  },
};

/** One key per Processing, beside the WAV it converts. */
const mp3KeyOf = (processing: ProcessingRef, kind: Mp3Kind): string =>
  `${MP3_OF[kind].folder}/${processing.trackId}/${processing.id}.mp3`;

const wavUrlOf = (
  processing: ProcessingRef,
  urls: StoredAudioUrls,
  kind: Mp3Kind,
): string => {
  const url = MP3_OF[kind].wavUrl(urls);
  if (url === null) {
    throw new Error(
      `Processing ${processing.id} has no ${kind} WAV to convert`,
    );
  }
  return url;
};

/** An MP3 as a step has it: its public URL, and its bytes when this run converted it. */
type StoredMp3 = { url: string; bytes?: Uint8Array<ArrayBuffer> };

/**
 * The MP3s of a Processing (ADR 0004): each WAV is converted with the legacy
 * parameters, stored publicly, and its URL saved on the Processing. The vocals
 * are converted for the transcription, in the lyrics step. The music is converted
 * by a job of its own (see `queueMusicMp3`), which the lyrics never wait for. A
 * run that finds an MP3 already stored converts nothing.
 */
@Injectable()
export class TrackMp3Service {
  constructor(
    private readonly ffmpeg: FfmpegClient,
    private readonly storage: StorageService,
    private readonly processings: TrackProcessingRepository,
    @InjectQueue(TRACK_MP3_QUEUE)
    private readonly queue: Queue<StoreMusicMp3Job>,
  ) {}

  /**
   * Queues the music MP3 as a job of its own. Its failures are retried there,
   * and the lyrics never wait for it.
   */
  async queueMusicMp3(processing: ProcessingRef): Promise<void> {
    await this.queue.add(
      STORE_MUSIC_MP3_JOB,
      { trackId: processing.trackId, processingId: processing.id },
      { jobId: musicMp3JobId(processing.id) },
    );
  }

  /** Stores the music MP3 (the job's work). Its bytes are not needed, so none are read back. */
  async storeMusicMp3(processing: ProcessingRef): Promise<void> {
    await this.store(processing, 'music');
  }

  /** Stores the vocals MP3 and answers its bytes, which the transcription reads. */
  async storeVocalsMp3(
    processing: ProcessingRef,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const stored = await this.store(processing, 'vocals');
    return stored.bytes ?? this.storage.downloadPublicObject(stored.url);
  }

  /**
   * The MP3 of one kind, stored and saved. A saved URL, or an object already in
   * storage, is kept as it is: only a missing MP3 is converted.
   */
  private async store(
    processing: ProcessingRef,
    kind: Mp3Kind,
  ): Promise<StoredMp3> {
    const urls = await this.processings.findAudioUrls(processing.id);
    const saved = MP3_OF[kind].mp3Url(urls);
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
    await this.processings.saveMp3Url(processingId, kind, url);
    return url;
  }
}
