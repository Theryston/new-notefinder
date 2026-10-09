import type { Env } from '../../config/env.js';

/** The RunPod endpoint the note detection starts its jobs on, and the key that calls it. */
export type NoteDetectionConfig = { apiKey: string; endpointId: string };

/**
 * The note detection's configuration. It is required in production, so the
 * API refuses to boot there without it; elsewhere, without it, the note
 * detection fails each Processing that reaches it. Checked here, not in the
 * env schema, because the env schema is shared by every environment and only
 * the app that runs in production needs these.
 *
 * @throws {Error} in production when either variable is missing.
 */
export const resolveNoteDetectionConfig = (
  env: Pick<Env, 'NODE_ENV' | 'RUNPOD_API_KEY' | 'RUNPOD_ENDPOINT_ID'>,
): NoteDetectionConfig | undefined => {
  const apiKey = env.RUNPOD_API_KEY;
  const endpointId = env.RUNPOD_ENDPOINT_ID;
  if (apiKey !== undefined && endpointId !== undefined) {
    return { apiKey, endpointId };
  }
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Note detection is not configured: set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID',
    );
  }
  return undefined;
};
