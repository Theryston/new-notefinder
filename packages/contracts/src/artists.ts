import { z } from 'zod';

export const artistSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Only tracks whose notes are ready (the ones listed publicly).
  trackCount: z.number().int(),
});

export type Artist = z.infer<typeof artistSchema>;
