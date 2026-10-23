import { z } from 'zod';

// The Redis queue that buffers ingestion: the endpoint answers at once and a
// job stores the batch. See docs/adr/0013-events-and-acquisition.md.

export const EVENTS_QUEUE = 'events';
export const STORE_EVENTS_JOB = 'store-events';

/** One event as the queue carries it: the columns plus the raw payload. */
const storedEventSchema = z.object({
  visitorId: z.string().min(1).max(64),
  userId: z.string().min(1).max(128).nullable(),
  type: z.string().min(1).max(64),
  rowId: z.string().min(1).max(64).nullable(),
  feedVersion: z.string().min(1).max(64).nullable(),
  algorithmVersion: z.number().int().positive().nullable(),
  itemId: z.string().min(1).max(128).nullable(),
  position: z.number().int().nonnegative().nullable(),
  clickId: z.string().min(1).max(128).nullable().optional(),
  payload: z.unknown(),
});

export type StoredEvent = z.infer<typeof storedEventSchema>;

/** A queued batch: one request's events, stored with a single `INSERT`. */
export const storeEventsJobSchema = z.array(storedEventSchema).min(1);

export type StoreEventsJob = z.infer<typeof storeEventsJobSchema>;
