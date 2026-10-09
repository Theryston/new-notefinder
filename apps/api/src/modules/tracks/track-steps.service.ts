import { Injectable } from '@nestjs/common';
import { TrackAudioService } from './track-audio.service.js';
import { TrackNoteDetectionService } from './track-note-detection.service.js';
import type { StepWait } from './track-processing.job.js';
import type { ProcessingForStep } from './track-processing.repository.js';
import type { StepOutcome } from './track-step-outcome.js';
import { TrackVideoStepService } from './track-video-step.service.js';

/**
 * The per-step services of a Processing behind one provider. The pipeline
 * depends on this instead of on each step's service, so its constructor stays
 * within the parameter limit as steps are added.
 */
@Injectable()
export class TrackStepsService {
  constructor(
    private readonly video: TrackVideoStepService,
    private readonly audio: TrackAudioService,
    private readonly noteDetection: TrackNoteDetectionService,
  ) {}

  /** The find-video step; answers the artwork of the best search match (see TrackVideoStepService). */
  findVideo(processing: ProcessingForStep): Promise<string | null | undefined> {
    return this.video.run(processing);
  }

  /** The download step: asks for, checks or stores the audio (see TrackAudioService). */
  downloadAudio(
    processing: ProcessingForStep,
    wait: StepWait | undefined,
  ): Promise<StepOutcome> {
    return this.audio.run(processing, wait);
  }

  /** The vocals stage of the note detection (see TrackNoteDetectionService). */
  extractVocals(
    processing: ProcessingForStep,
    wait: StepWait | undefined,
  ): Promise<StepOutcome> {
    return this.noteDetection.extractVocals(processing, wait);
  }

  /** The notes stage of the note detection (see TrackNoteDetectionService). */
  detectNotes(
    processing: ProcessingForStep,
    wait: StepWait | undefined,
  ): Promise<StepOutcome> {
    return this.noteDetection.detectNotes(processing, wait);
  }
}
