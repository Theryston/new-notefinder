import { z } from 'zod';

export const TRACK_ASSOCIATION_QUEUE = 'track-association';
export const DELIVER_TRACK_ASSOCIATIONS_JOB = 'deliver-track-associations';

/** Polling is cheap and makes committed outbox rows recover after restarts. */
export const TRACK_ASSOCIATION_SCHEDULER_ID =
  'deliver-track-associations-every-five-seconds';
export const TRACK_ASSOCIATION_POLL_INTERVAL_MS = 5_000;

export const TRACK_ASSOCIATION_BATCH_SIZE = 50;
export const TRACK_ASSOCIATION_CLAIM_LEASE_MS = 60_000;
export const TRACK_ASSOCIATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const TRACK_ASSOCIATION_CLEANUP_BATCH_SIZE = 500;

export const deliverTrackAssociationsJobSchema = z.object({});
export type DeliverTrackAssociationsJob = z.infer<
  typeof deliverTrackAssociationsJobSchema
>;
