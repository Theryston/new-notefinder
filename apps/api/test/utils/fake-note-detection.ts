import type { NoteDetectionInput } from '../../src/integrations/note-detection/note-detection.client.js';
import {
  type RunpodJobState,
  runpodJobStateOf,
} from '../../src/integrations/note-detection/runpod-job.js';

/** One note of the fake worker's output. */
export type FakeNote = {
  note: string;
  octave: number;
  start: number;
  end: number;
  frequencyMean: number;
};

/**
 * What a check of the fake RunPod answers, as RunPod's `/status` sends it: the
 * job's status, and the worker's progress update (its stage) while it runs. A
 * `COMPLETED` answer carries the output the worker would give for the job: the
 * vocals URL it was asked to upload to, and the notes the spec sets. The fake
 * hands these bodies to the real state mapping, so each status is read the way
 * the client reads it.
 */
export type FakeRunpodAnswer = { status: string; output?: string };

/** Two notes a completed job detects by default. */
export const FAKE_NOTES: FakeNote[] = [
  { note: 'A#', octave: 4, start: 1.23, end: 1.61, frequencyMean: 466.16 },
  { note: 'C', octave: 5, start: 2.0, end: 2.4, frequencyMean: 523.25 },
];

/**
 * The RunPod note detection, faked at its integration boundary for the e2e
 * specs. A job is started with the input the API sends, and each check answers
 * the next of `answers` (the last one repeats). Every call is recorded, so a
 * spec asserts what was asked and what was not.
 */
export class FakeNoteDetection {
  /** The inputs of the jobs started, in order. */
  readonly starts: NoteDetectionInput[] = [];
  /** The job IDs checked, in order. */
  readonly checks: string[] = [];
  /** What the checks answer, in order; the last answer repeats. */
  answers: FakeRunpodAnswer[] = [{ status: 'COMPLETED' }];
  /** The notes a completed job detects. */
  notes: FakeNote[] = FAKE_NOTES;
  /** When set, RunPod refuses every call: it is down. */
  requestFailure: Error | undefined;
  private readonly inputs = new Map<string, NoteDetectionInput>();

  /** Back to the answers of a fresh fake, with no calls recorded. */
  reset(): void {
    this.starts.length = 0;
    this.checks.length = 0;
    this.inputs.clear();
    this.answers = [{ status: 'COMPLETED' }];
    this.notes = FAKE_NOTES;
    this.requestFailure = undefined;
  }

  async startJob(input: NoteDetectionInput): Promise<string> {
    if (this.requestFailure !== undefined) {
      throw this.requestFailure;
    }
    this.starts.push(input);
    const jobId = `runpod-job-${this.starts.length}`;
    this.inputs.set(jobId, input);
    return jobId;
  }

  async checkJob(jobId: string): Promise<RunpodJobState> {
    if (this.requestFailure !== undefined) {
      throw this.requestFailure;
    }
    this.checks.push(jobId);
    const answer = this.answers[
      Math.min(this.checks.length - 1, this.answers.length - 1)
    ] ?? { status: 'COMPLETED' };
    return runpodJobStateOf(this.bodyOf(jobId, answer));
  }

  /**
   * Plays the worker's upload: the vocals WAV goes to the presigned URL of the
   * job, as `apps/nfp-audio` sends it (the Content-Type of its input).
   */
  async uploadVocals(
    jobId: string,
    wav: Uint8Array<ArrayBuffer>,
  ): Promise<Response> {
    const input = this.inputs.get(jobId);
    if (input === undefined) {
      throw new Error(`No job ${jobId} was started`);
    }
    return fetch(input.vocalsUpload.presignedPutUrl, {
      method: 'PUT',
      headers: { 'content-type': input.vocalsUpload.contentType },
      body: wav,
    });
  }

  /** The `/status` body RunPod would answer with for this answer. */
  private bodyOf(jobId: string, answer: FakeRunpodAnswer) {
    if (answer.status !== 'COMPLETED') {
      return { id: jobId, status: answer.status, output: answer.output };
    }
    return {
      id: jobId,
      status: 'COMPLETED',
      output: {
        vocalsUrl: this.inputs.get(jobId)?.vocalsUpload.publicUrl,
        notes: this.notes,
      },
    };
  }
}
