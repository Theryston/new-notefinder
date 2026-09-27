import { z } from 'zod';

/**
 * Body of the web's `POST /api/revalidate`, sent by the API after it changes
 * data the web caches. Tags come from `cacheTags`; Next ignores tags longer
 * than 256 characters.
 */
export const revalidateBodySchema = z.object({
  tags: z.array(z.string().min(1).max(256)).min(1).max(50),
});

export type RevalidateBody = z.infer<typeof revalidateBodySchema>;
