import { z } from 'zod';

/** Direct audio URLs are delivered only to authorized listeners. */
export const trackAudioSchema = z.object({
  musicMp3Url: z.url(),
  vocalsMp3Url: z.url(),
});
export type TrackAudio = z.infer<typeof trackAudioSchema>;
