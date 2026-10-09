import type { Env } from '../../config/env.js';

/** The RunPod endpoint the note detection starts its jobs on, and the key that calls it. */
export type NoteDetectionConfig = { apiKey: string; endpointId: string };

/**
 * The note detection's configuration, or `undefined` when either variable is
 * unset. The env schema requires both in production; elsewhere, without them,
 * the note detection fails each Processing that reaches it.
 */
export const resolveNoteDetectionConfig = (
  env: Pick<Env, 'RUNPOD_API_KEY' | 'RUNPOD_ENDPOINT_ID'>,
): NoteDetectionConfig | undefined => {
  const apiKey = env.RUNPOD_API_KEY;
  const endpointId = env.RUNPOD_ENDPOINT_ID;
  if (apiKey !== undefined && endpointId !== undefined) {
    return { apiKey, endpointId };
  }
  return undefined;
};
