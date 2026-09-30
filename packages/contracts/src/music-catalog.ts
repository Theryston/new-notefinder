import { z } from 'zod';

// The Music catalog protocol: private, spoken over a WebSocket between the
// Music catalog service and its internal clients (the API, later others). It
// is deliberately separate from `apiErrorSchema` and the API's DTOs, so
// nothing here reaches the public OpenAPI document.

/**
 * Stable error codes of the protocol. `UNAUTHORIZED` is only answered to the
 * handshake (as HTTP 401); every other code travels in an error response.
 * Never rename one: add a new code instead.
 */
export const musicCatalogErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'VALIDATION_FAILED',
  'UNKNOWN_REQUEST_TYPE',
  'CATALOG_NOT_READY',
  'RECORDING_NOT_FOUND',
  'RECORDING_MOVED',
  'INTERNAL',
]);

export type MusicCatalogErrorCode = z.infer<typeof musicCatalogErrorCodeSchema>;

/** `message` is an English developer message, never shown as-is to users. */
export const musicCatalogErrorSchema = z.object({
  code: musicCatalogErrorCodeSchema,
  message: z.string(),
});

export type MusicCatalogError = z.infer<typeof musicCatalogErrorSchema>;

/** Chosen by the client and echoed by the response that answers the request. */
export const musicCatalogRequestIdSchema = z.string().min(1).max(128);

export type MusicCatalogRequestId = z.infer<typeof musicCatalogRequestIdSchema>;

/**
 * Every operation the service answers. A new operation adds its type here,
 * its payload and result schemas next to it, and a handler in the service.
 */
export const musicCatalogRequestTypeSchema = z.enum(['status']);

export type MusicCatalogRequestType = z.infer<
  typeof musicCatalogRequestTypeSchema
>;

/**
 * The envelope of any request as the service first reads it. `type` is a
 * plain string here, so an unknown type is answered `UNKNOWN_REQUEST_TYPE`
 * instead of `VALIDATION_FAILED`; each operation then validates its own
 * `payload`.
 */
export const musicCatalogRequestSchema = z.object({
  id: musicCatalogRequestIdSchema,
  type: z.string().min(1),
  // Optional: an operation that takes no arguments may omit it.
  payload: z.unknown().optional(),
});

export type MusicCatalogRequest = z.infer<typeof musicCatalogRequestSchema>;

export const musicCatalogSuccessResponseSchema = <TResult extends z.ZodType>(
  result: TResult,
) =>
  z.object({
    id: musicCatalogRequestIdSchema,
    ok: z.literal(true),
    result,
  });

export type MusicCatalogSuccessResponse<TResult = unknown> = {
  id: MusicCatalogRequestId;
  ok: true;
  result: TResult;
};

/** `id` is null when the request was too broken for its `id` to be read. */
export const musicCatalogErrorResponseSchema = z.object({
  id: musicCatalogRequestIdSchema.nullable(),
  ok: z.literal(false),
  error: musicCatalogErrorSchema,
});

export type MusicCatalogErrorResponse = z.infer<
  typeof musicCatalogErrorResponseSchema
>;

export type MusicCatalogResponse<TResult = unknown> =
  | MusicCatalogSuccessResponse<TResult>
  | MusicCatalogErrorResponse;

/**
 * Where the first import stands: `restoring` the MusicBrainz dump, then
 * `indexing` every Recording, then `ready`. It never goes back once `ready`.
 */
export const bootstrapPhaseSchema = z.enum(['restoring', 'indexing', 'ready']);

export type BootstrapPhase = z.infer<typeof bootstrapPhaseSchema>;

/** `sample` is the small MusicBrainz sample used in development. */
export const catalogDatasetSchema = z.enum(['sample', 'full']);

export type CatalogDataset = z.infer<typeof catalogDatasetSchema>;

/** `status` takes no arguments; a missing payload counts as an empty one. */
export const musicCatalogStatusPayloadSchema = z.object({}).optional();

export type MusicCatalogStatusPayload = z.infer<
  typeof musicCatalogStatusPayloadSchema
>;

export const musicCatalogStatusResultSchema = z.object({
  phase: bootstrapPhaseSchema,
  dataset: catalogDatasetSchema,
});

export type MusicCatalogStatusResult = z.infer<
  typeof musicCatalogStatusResultSchema
>;

/** What a client reads back for a `status` request. */
export const musicCatalogStatusResponseSchema = z.discriminatedUnion('ok', [
  musicCatalogSuccessResponseSchema(musicCatalogStatusResultSchema),
  musicCatalogErrorResponseSchema,
]);

export type MusicCatalogStatusResponse = z.infer<
  typeof musicCatalogStatusResponseSchema
>;
