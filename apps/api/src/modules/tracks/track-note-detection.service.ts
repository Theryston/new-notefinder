import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  NoteDetectionClient,
  type NoteDetectionInput,
  type NoteDetectionUpload,
} from '../../integrations/note-detection/note-detection.client.js';
import {
  type NoteDetectionOutput,
  noteDetectionOutputOf,
} from '../../integrations/note-detection/note-detection-output.js';
import type { RunpodJobState } from '../../integrations/note-detection/runpod-job.js';
import { StorageService } from '../../integrations/storage/storage.service.js';
import {
  isNotesStage,
  NOTE_POLL_INTERVAL_MS,
  type UnfinishedJobState,
  unfinishedOutcomeOf,
} from './track-note-detection-polling.js';
import { TrackNotesService } from './track-notes.service.js';
import type { StepWait } from './track-processing.job.js';
import {
  type ProcessingForStep,
  TrackProcessingRepository,
} from './track-processing.repository.js';
import { attemptStepCall } from './track-processing-failure.js';
import {
  DONE,
  STOPPED,
  type StepOutcome,
  waitFor,
} from './track-step-outcome.js';

const WAV_CONTENT_TYPE = 'audio/wav';
const PITCH_CURVE_CONTENT_TYPE = 'application/octet-stream';

// The worker uploads the files once it has made them, which can wait for a GPU
// to start: the uploads stay allowed for two hours.
const UPLOAD_TTL_SECONDS = 2 * 60 * 60;

/** The vocals WAV of a Processing: one key per Processing, as the download's WAV is. */
const vocalsKeyOf = (processing: ProcessingForStep): string =>
  `track-vocals/${processing.trackId}/${processing.id}.wav`;

/** The Pitch curve of a Processing: one key per Processing, next to the vocals. */
const pitchCurveKeyOf = (processing: ProcessingForStep): string =>
  `track-pitch-curves/${processing.trackId}/${processing.id}.bin`;

/**
 * The note detection steps (ADR 0004). Both stages drive one RunPod job of
 * `apps/note-detector`, which the vocals stage starts and saves the ID of. The
 * vocals stage ends when the worker reports its notes stage, and the notes
 * stage reads the job's output. The job is never called back: each check is a
 * delayed re-run of its step.
 */
@Injectable()
export class TrackNoteDetectionService {
  private readonly logger = new Logger(TrackNoteDetectionService.name);

  constructor(
    private readonly client: NoteDetectionClient,
    private readonly storage: StorageService,
    private readonly processings: TrackProcessingRepository,
    private readonly notes: TrackNotesService,
  ) {}

  /**
   * The vocals stage. Without a saved job it starts one, then checks it again
   * after a delay. With one (a replayed run, or a re-check) it reads the job, so
   * a job is never started twice. The stage is done once the worker reports the
   * notes stage, or the job has already completed.
   */
  async extractVocals(
    processing: ProcessingForStep,
    wait: StepWait | undefined,
  ): Promise<StepOutcome> {
    const jobId = await this.processings.findRunpodJobId(processing.id);
    if (jobId === null) {
      return this.startJob(processing);
    }
    const state = await this.checkJob(jobId);
    if (state.kind === 'completed' || isNotesStage(state)) {
      return DONE;
    }
    return this.unfinished(processing, state, wait?.round ?? 0);
  }

  /**
   * The notes stage. It reads the job until it completes, then stores its
   * output: the vocals' and Pitch curve's URLs, the version and the notes.
   */
  async detectNotes(
    processing: ProcessingForStep,
    wait: StepWait | undefined,
  ): Promise<StepOutcome> {
    const jobId = await this.processings.findRunpodJobId(processing.id);
    if (jobId === null) {
      throw new Error(
        `Processing ${processing.id} has no RunPod job to read the notes of`,
      );
    }
    const state = await this.checkJob(jobId);
    if (state.kind === 'completed') {
      return this.saveOutput(processing, noteDetectionOutputOf(state.output));
    }
    return this.unfinished(processing, state, wait?.round ?? 0);
  }

  /**
   * Starts the job with the Processing's music and its two uploads, then
   * saves the job's ID. Stops without saving when the Processing moved on.
   */
  private async startJob(processing: ProcessingForStep): Promise<StepOutcome> {
    const musicUrl = await this.processings.findMusicWavUrl(processing.id);
    if (musicUrl === null) {
      throw new Error(
        `Processing ${processing.id} has no music WAV to separate`,
      );
    }
    const input = await this.inputOf(processing, musicUrl);
    const jobId = await this.attempt('start the note detection', () =>
      this.client.startJob(input),
    );
    const saved = await this.processings.saveRunpodJobId(processing.id, jobId);
    return saved ? waitFor(NOTE_POLL_INTERVAL_MS, null) : STOPPED;
  }

  /**
   * The job's input. The worker gets a presigned PUT for the vocals and for the
   * Pitch curve, each with the public URL it will have, so it holds no storage
   * credentials.
   */
  private async inputOf(
    processing: ProcessingForStep,
    musicUrl: string,
  ): Promise<NoteDetectionInput> {
    return {
      processingId: processing.id,
      musicUrl,
      vocalsUpload: await this.uploadOf(
        vocalsKeyOf(processing),
        WAV_CONTENT_TYPE,
      ),
      pitchCurveUpload: await this.uploadOf(
        pitchCurveKeyOf(processing),
        PITCH_CURVE_CONTENT_TYPE,
      ),
    };
  }

  private async uploadOf(
    key: string,
    contentType: string,
  ): Promise<NoteDetectionUpload> {
    return {
      presignedPutUrl: await this.storage.presignPublicPut({
        key,
        contentType,
        expiresInSeconds: UPLOAD_TTL_SECONDS,
      }),
      contentType,
      publicUrl: this.storage.publicUrl(key),
    };
  }

  /**
   * Stores the notes stage's output in one transaction: the vocals' and Pitch
   * curve's URLs and the detector version on the Processing, and the Track's
   * notes replaced by these. A Processing that moved on keeps its row, and the
   * Track keeps its notes.
   */
  @Transactional()
  private async saveOutput(
    processing: ProcessingForStep,
    output: NoteDetectionOutput,
  ): Promise<StepOutcome> {
    const saved = await this.processings.saveDetection(processing.id, {
      vocalsWavUrl: output.vocalsUrl,
      pitchCurveUrl: output.pitchCurveUrl,
      detectorVersion: output.detectorVersion,
    });
    if (!saved) {
      return STOPPED;
    }
    await this.notes.replaceNotes(processing.trackId, output.notes);
    return DONE;
  }

  /** The job's state from RunPod; a failed read is retried by BullMQ. */
  private checkJob(jobId: string): Promise<RunpodJobState> {
    return this.attempt('check the note detection', () =>
      this.client.checkJob(jobId),
    );
  }

  /**
   * The outcome of a check that found the job unfinished, logged when it ends
   * the Processing so the cause is in the logs.
   */
  private unfinished(
    processing: ProcessingForStep,
    state: UnfinishedJobState,
    round: number,
  ): StepOutcome {
    const outcome = unfinishedOutcomeOf(state, round);
    if (outcome.kind === 'failed') {
      const cause =
        state.kind === 'failed'
          ? 'RunPod ended the job'
          : `the job was still running after ${round} checks`;
      this.logger.warn(
        `The note detection of Processing ${processing.id} failed: ${cause}`,
      );
    }
    return outcome;
  }

  /** One call to RunPod; a failure of it is a `NOTE_DETECTION_FAILED`. */
  private attempt<T>(action: string, work: () => Promise<T>): Promise<T> {
    return attemptStepCall(this.logger, 'NOTE_DETECTION_FAILED', action, work);
  }
}
