/**
 * TanStack Query keys of the Track features: one key per Track's Processing
 * state (which the Processing page polls) and one each for the practice
 * header, the notes and the lyrics (which it reads once the Processing has completed).
 */
export const trackKeys = {
  all: ['tracks'] as const,
  processing: (trackId: string) =>
    [...trackKeys.all, trackId, 'processing'] as const,
  practice: (trackId: string) =>
    [...trackKeys.all, trackId, 'practice'] as const,
  notes: (trackId: string) => [...trackKeys.all, trackId, 'notes'] as const,
  lyrics: (trackId: string) => [...trackKeys.all, trackId, 'lyrics'] as const,
  directAudio: (trackId: string) =>
    [...trackKeys.all, trackId, 'direct-audio'] as const,
  /** What the signed-in User has with the Track (the favorite). */
  userState: (trackId: string) =>
    [...trackKeys.all, trackId, 'user-state'] as const,
};
