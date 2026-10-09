import { Injectable, Logger } from '@nestjs/common';
import { AudioDownloadClient } from '../../integrations/audio-download/audio-download.client.js';
import { FfmpegClient } from '../../integrations/ffmpeg/ffmpeg.client.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import {
  AUDIO_POLL_INTERVAL_MS,
  audioWaitStateSchema,
  isPollBudgetSpent,
} from './track-audio-polling.js';
import type { StepWait } from './track-processing.job.js';
import {
  type ProcessingForStep,
  TrackProcessingRepository,
} from './track-processing.repository.js';
import {
  messageOf,
  TrackProcessingFailure,
} from './track-processing-failure.js';
import { DONE, type StepOutcome, waitFor } from './track-step-outcome.js';

/**
 * The download step (ADR 0004). The RapidAPI service converts the chosen
 * video to MP3, ffmpeg turns it into WAV, and the WAV is stored publicly so
 * note detection can read it. The first run asks for the conversion and waits;
 * each re-check asks for its progress again. A Processing whose WAV is already
 * stored downloads nothing.
 */
@Injectable()
export class TrackAudioService {
  private readonly logger = new Logger(TrackAudioService.name);

  constructor(
    private readonly downloads: AudioDownloadClient,
    private readonly ffmpeg: FfmpegClient,
    private readonly storage: StorageService,
    private readonly processings: TrackProcessingRepository,
  ) {}

  /** One run of the step: a request, a re-check or, once stored, nothing. */
  async run(
    processing: ProcessingForStep,
    wait: StepWait | undefined,
  ): Promise<StepOutcome> {
    if ((await this.processings.findMusicWavUrl(processing.id)) !== null) {
      return DONE;
    }
    return wait === undefined
      ? this.requestConversion(processing)
      : this.checkConversion(processing, wait);
  }

  private async requestConversion(
    processing: ProcessingForStep,
  ): Promise<StepOutcome> {
    const videoId = processing.videoId;
    if (videoId === null) {
      throw new Error(`Processing ${processing.id} has no video to download`);
    }
    const progressUrl = await this.attempt('request the conversion', () =>
      this.downloads.requestConversion(videoId),
    );
    return waitFor(AUDIO_POLL_INTERVAL_MS, { progressUrl });
  }

  private async checkConversion(
    processing: ProcessingForStep,
    wait: StepWait,
  ): Promise<StepOutcome> {
    const { progressUrl } = audioWaitStateSchema.parse(wait.state);
    const progress = await this.attempt('check the conversion', () =>
      this.downloads.checkConversion(progressUrl),
    );
    if (progress.ready) {
      return this.store(processing, progress.downloadUrl);
    }
    if (isPollBudgetSpent(wait.round)) {
      this.logger.warn(
        `The conversion of Processing ${processing.id} did not finish in ${wait.round} checks`,
      );
      throw new TrackProcessingFailure('DOWNLOAD_FAILED');
    }
    return waitFor(AUDIO_POLL_INTERVAL_MS, { progressUrl });
  }

  /**
   * Downloads the MP3, converts it and stores the WAV under the Track's key,
   * then saves its URL on the Processing. A storage failure is not a download
   * failure, so it is not reported as one.
   */
  private async store(
    processing: ProcessingForStep,
    downloadUrl: string,
  ): Promise<StepOutcome> {
    const mp3 = await this.attempt('download the MP3', () =>
      this.downloads.downloadMp3(downloadUrl),
    );
    const wav = await this.attempt('convert the MP3 to WAV', () =>
      this.ffmpeg.convertMp3ToWav(mp3),
    );
    const key = `track-audio/${processing.trackId}.wav`;
    await this.storage.putPublicObject({
      key,
      body: wav,
      contentType: 'audio/wav',
    });
    await this.processings.saveMusicWavUrl(
      processing.id,
      this.storage.publicUrl(key),
    );
    return DONE;
  }

  /**
   * Runs one call to the download services. Any failure of it is a
   * `DOWNLOAD_FAILED` (retryable); the cause goes to the log.
   */
  private async attempt<T>(action: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      this.logger.warn(`Could not ${action}: ${messageOf(error)}`);
      throw new TrackProcessingFailure('DOWNLOAD_FAILED');
    }
  }
}
