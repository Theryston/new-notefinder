import { z } from 'zod';

// The queue of a Track's metadata import (ADR 0005): the Artists and Albums of
// its Recording, imported beside the Processing. Its own queue, so a slow
// catalog never holds a Processing step back.
//
// The job is queued by the tracks module and run by the track-metadata module.
// Neither may import the other's files, so the definition lives with the queue
// configuration that both use.

export const TRACK_METADATA_QUEUE = 'track-metadata';
export const IMPORT_METADATA_JOB = 'import-metadata';

export const importMetadataJobSchema = z.object({
  trackId: z.string().min(1).max(128),
});

export type ImportMetadataJob = z.infer<typeof importMetadataJobSchema>;

/**
 * Keyed by the Processing that asked for the import, so a retry (a new
 * Processing) gets a job of its own, and a repeated enqueue of the same
 * Processing is a no-op.
 */
export const metadataJobId = (processingId: string): string =>
  `metadata-${processingId}`;
