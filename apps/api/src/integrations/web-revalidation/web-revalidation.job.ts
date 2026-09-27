import {
  type RevalidateBody,
  revalidateBodySchema,
} from '@notefinder/contracts';

export const WEB_REVALIDATION_QUEUE = 'web-revalidation';
export const WEB_REVALIDATION_JOB = 'revalidate';

// The job payload is exactly the body the web's POST /api/revalidate expects.
export const webRevalidationJobSchema = revalidateBodySchema;

export type WebRevalidationJob = RevalidateBody;
