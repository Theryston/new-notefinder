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

/**
 * The identifier MusicBrainz gives every entity (its public UUID, the `gid`),
 * and the only identity of a Recording: MusicBrainz's integer ids disappear
 * on a merge, MBIDs stay resolvable. Any UUID-shaped text is accepted, since
 * MusicBrainz's own MBIDs are not guaranteed to carry an RFC 4122 version.
 */
export const mbidSchema = z.guid();

export type Mbid = z.infer<typeof mbidSchema>;

/**
 * `message` is an English developer message, never shown as-is to users.
 * `newMbid` is only present on `RECORDING_MOVED`: the MBID the requested
 * Recording was merged into, so the client can update what it stored.
 */
export const musicCatalogErrorSchema = z.object({
  code: musicCatalogErrorCodeSchema,
  message: z.string(),
  newMbid: mbidSchema.optional(),
});

export type MusicCatalogError = z.infer<typeof musicCatalogErrorSchema>;

/** Chosen by the client and echoed by the response that answers the request. */
export const musicCatalogRequestIdSchema = z.string().min(1).max(128);

export type MusicCatalogRequestId = z.infer<typeof musicCatalogRequestIdSchema>;

/**
 * Every operation the service answers. A new operation adds its type here,
 * its payload and result schemas next to it, and a handler in the service.
 */
export const musicCatalogRequestTypeSchema = z.enum([
  'status',
  'getRecording',
  'search',
]);

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
 * Where the first import stands, in this order: the MusicBrainz dump is being
 * `restoring` and then `restored` (both recorded by the mbslave container),
 * then every Recording is being `indexing` and finally `ready` (both recorded
 * by the worker). It never goes back once `ready`.
 */
export const BOOTSTRAP_PHASES = [
  'restoring',
  'restored',
  'indexing',
  'ready',
] as const;

export const bootstrapPhaseSchema = z.enum(BOOTSTRAP_PHASES);

export type BootstrapPhase = z.infer<typeof bootstrapPhaseSchema>;

/**
 * Which data the first import lays down. `full` restores the official
 * MusicBrainz dumps (production). `tiny` seeds a small deterministic catalog
 * locally in seconds (development): no downloads, megabytes of disk.
 */
export const CATALOG_DATASETS = ['full', 'tiny'] as const;

export const catalogDatasetSchema = z.enum(CATALOG_DATASETS);

export type CatalogDataset = z.infer<typeof catalogDatasetSchema>;

/** `status` takes no arguments; a missing payload counts as an empty one. */
export const musicCatalogStatusPayloadSchema = z.object({}).optional();

export type MusicCatalogStatusPayload = z.infer<
  typeof musicCatalogStatusPayloadSchema
>;

/**
 * Why replication stopped applying packets. `schema-change` is MusicBrainz's
 * yearly schema change: `mbslave sync` fails with a schema mismatch until a
 * compatible mbslave restores the new dump (issue #69). Never rename a
 * reason: add a new one instead.
 */
export const replicationStallReasonSchema = z.enum(['schema-change']);

export type ReplicationStallReason = z.infer<
  typeof replicationStallReasonSchema
>;

/** Replication stalled, with the reason and mbslave's message, when set. */
export const replicationStalledSchema = z.object({
  reason: replicationStallReasonSchema,
  detail: z.string().optional(),
});

export type ReplicationStalled = z.infer<typeof replicationStalledSchema>;

/**
 * Where the blue-green reimport stands, in this order: the new dump is being
 * `restoring` into the parallel copy, then `indexing` it, then `switching`
 * the serving copy over to it. Reported while `phase` above stays `ready`,
 * so clients keep reading from the current copy throughout.
 */
export const REIMPORT_PHASES = ['restoring', 'indexing', 'switching'] as const;

export const reimportPhaseSchema = z.enum(REIMPORT_PHASES);

export type ReimportPhase = z.infer<typeof reimportPhaseSchema>;

/** The reimport phase with its progress, when one is running. */
export const musicCatalogReimportStatusSchema = z.object({
  phase: reimportPhaseSchema,
  progressPct: z.number().int().min(0).max(100).optional(),
});

export type MusicCatalogReimportStatus = z.infer<
  typeof musicCatalogReimportStatusSchema
>;

export const musicCatalogStatusResultSchema = z.object({
  phase: bootstrapPhaseSchema,
  dataset: catalogDatasetSchema,
  // Continuous replication (issue #62, `full` mode only): the last replication
  // packet the mbslave container applied. Null until the first packet lands;
  // absent when the service answers without replication state. A sequence
  // that stops advancing while packets are published means replication
  // stalled (the yearly schema change, handled by #69, looks exactly so).
  replicationSequence: z.number().int().nonnegative().nullable().optional(),
  // Entries still waiting to reach the search index: the replication lag
  // operators watch next to the sequence above.
  pendingOutbox: z.number().int().nonnegative().optional(),
  // Set while replication cannot apply packets: the yearly schema change
  // reports `schema-change` here until the blue-green reimport finishes.
  replicationStalled: replicationStalledSchema.optional(),
  // The blue-green reimport rebuilding the catalog next to the serving copy.
  // Present only while one runs; `phase` above stays `ready` throughout.
  reimport: musicCatalogReimportStatusSchema.optional(),
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
