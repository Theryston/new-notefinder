import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OpenAiTranscriptionClient } from '../../integrations/openai/openai-transcription.client.js';
import { TrackLyricsRepository } from './track-lyrics.repository.js';
import { type TimedLyricLine, timedLyricsOf } from './track-lyrics-lines.js';
import { TrackLyricsPromptService } from './track-lyrics-prompt.service.js';
import { TrackMp3Service } from './track-mp3.service.js';
import type { ProcessingForStep } from './track-processing.repository.js';
import { DONE, STOPPED, type StepOutcome } from './track-step-outcome.js';

/**
 * The lyrics step of a Processing (ADR 0004): the music and the vocals are
 * stored as MP3, then the vocals are transcribed into the Track's Timed lyrics,
 * guided by the Recording's Lyrics. A failure throws, so the pipeline retries
 * the step; on its last attempt the Processing completes without Timed lyrics.
 */
@Injectable()
export class TrackLyricsStepService {
  constructor(
    private readonly mp3s: TrackMp3Service,
    private readonly transcription: OpenAiTranscriptionClient,
    private readonly prompt: TrackLyricsPromptService,
    private readonly timedLyrics: TrackLyricsRepository,
  ) {}

  async run(processing: ProcessingForStep): Promise<StepOutcome> {
    await this.mp3s.storeMusicMp3(processing);
    const vocals = await this.mp3s.storeVocalsMp3(processing);
    const lyrics = await this.prompt.lyricsOf(processing.trackId);
    const transcribed = await this.transcription.transcribe({
      audio: vocals,
      lyrics,
    });
    return this.save(processing, timedLyricsOf(transcribed));
  }

  /**
   * The lines replace the Track's Timed lyrics in one transaction. A Processing
   * that moved on keeps its lyrics, and the step stops without advancing.
   */
  @Transactional()
  private async save(
    processing: ProcessingForStep,
    lines: TimedLyricLine[],
  ): Promise<StepOutcome> {
    const replaced = await this.timedLyrics.replaceTimedLyrics(
      processing.id,
      processing.trackId,
      lines,
    );
    return replaced ? DONE : STOPPED;
  }
}
