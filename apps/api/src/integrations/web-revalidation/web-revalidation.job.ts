import { z } from 'zod';

export const WEB_REVALIDATION_QUEUE = 'web-revalidation';
export const WEB_REVALIDATION_JOB = 'revalidate';

// Same limits as the web's POST /api/revalidate body (Next ignores tags
// longer than 256 characters).
export const webRevalidationJobSchema = z.object({
  tags: z.array(z.string().min(1).max(256)).min(1).max(50),
});

export type WebRevalidationJob = z.infer<typeof webRevalidationJobSchema>;
