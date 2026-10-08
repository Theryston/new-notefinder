/**
 * TanStack Query keys of the Track features: one key per Track's Processing
 * state, which the Processing page polls under that key.
 */
export const trackKeys = {
  all: ['tracks'] as const,
  processing: (trackId: string) =>
    [...trackKeys.all, trackId, 'processing'] as const,
};
