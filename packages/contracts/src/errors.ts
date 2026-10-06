import { z } from 'zod';

/**
 * Stable, machine-readable error codes. Clients translate these with i18n,
 * so never rename an existing code — add a new one instead.
 */
export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  // Signed in, but the account has no username yet: the client sends the
  // user to pick one (the only private action allowed until then).
  'USERNAME_REQUIRED',
  'NOT_FOUND',
  // A catalog ID from the legacy app: the record was reprocessed under a
  // new ID (in `details.id`), so the client redirects instead of 404ing.
  'RESOURCE_MOVED',
  'CONFLICT',
  'RATE_LIMITED',
  // Retryable downstream outages (the Music catalog for search): the client
  // retries with backoff instead of showing a dead end.
  'SERVICE_UNAVAILABLE',
  'GATEWAY_TIMEOUT',
  'INTERNAL_ERROR',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: apiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
