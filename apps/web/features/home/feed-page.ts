import { homeRowSchema } from '@notefinder/contracts';
import { z } from 'zod';

/**
 * One page of the home feed as the web reads it. Each row is checked on its
 * own: a row whose layout or shape this web doesn't know is dropped, so a newer
 * API never breaks the page (the contract's own schema would reject the whole
 * response). The audience stays a string here; the public cache accepts only
 * `public` (see `public-feed.ts`).
 */
export const homeFeedPageSchema = z.object({
  audience: z.string().min(1).max(32),
  version: z.string().min(1).max(64),
  algorithmVersion: z.number().int().positive(),
  rows: z
    .array(z.unknown())
    .max(24)
    .transform((rows) =>
      rows.flatMap((row) => {
        const parsed = homeRowSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  nextCursor: z.string().min(1).max(512).nullable(),
});

export type HomeFeedPage = z.output<typeof homeFeedPageSchema>;
