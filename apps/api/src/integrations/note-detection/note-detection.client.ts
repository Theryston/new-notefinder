import type { NoteDetectionConfig } from './note-detection-config.js';
import {
  type RunpodJobState,
  runpodJobIdOf,
  runpodJobStateOf,
} from './runpod-job.js';

// RunPod's serverless API for the endpoint that runs apps/nfp-audio (ADR 0004):
// a job is started with `/run` and read with `/status`. The only code that
// calls it. Features depend on this class, so tests replace it at this boundary.
const RUNPOD_API_URL = 'https://api.runpod.ai/v2';

// Without a deadline, a RunPod API that stops answering would hold a step open.
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The input of a note detection job, as `apps/nfp-audio` reads it (its
 * CLAUDE.md, "The job contract"). The worker gets URLs only: the presigned
 * upload and the public URL it will have, never storage credentials.
 */
export type NoteDetectionInput = {
  processingId: string;
  /** The public URL of the Processing's music WAV. */
  musicUrl: string;
  vocalsUpload: {
    presignedPutUrl: string;
    contentType: string;
    publicUrl: string;
  };
};

export class NoteDetectionClient {
  constructor(private readonly config: NoteDetectionConfig | undefined) {}

  /** Starts a job of the worker; answers the RunPod job ID to poll. */
  async startJob(input: NoteDetectionInput): Promise<string> {
    const config = this.configured();
    const response = await fetch(`${endpointUrl(config)}/run`, {
      method: 'POST',
      headers: headersOf(config),
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return runpodJobIdOf(await readJson(response));
  }

  /** The state of a job, from its `/status`. */
  async checkJob(jobId: string): Promise<RunpodJobState> {
    const config = this.configured();
    const response = await fetch(
      `${endpointUrl(config)}/status/${encodeURIComponent(jobId)}`,
      {
        headers: headersOf(config),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    return runpodJobStateOf(await readJson(response));
  }

  private configured(): NoteDetectionConfig {
    if (this.config === undefined) {
      throw new Error('RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are not set');
    }
    return this.config;
  }
}

const endpointUrl = ({ endpointId }: NoteDetectionConfig): string =>
  `${RUNPOD_API_URL}/${endpointId}`;

const headersOf = ({
  apiKey,
}: NoteDetectionConfig): Record<string, string> => ({
  authorization: `Bearer ${apiKey}`,
  'content-type': 'application/json',
});

/** The JSON body of a successful answer; any other status is an error. */
const readJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`RunPod answered HTTP ${response.status}`);
  }
  return response.json();
};
