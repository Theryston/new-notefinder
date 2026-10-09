import { z } from 'zod';

// The queue of a Track's metadata import (ADR 0005): the Artists and Albums of
// its Recording, imported in parallel with the Processing. Its own queue, so a
// slow catalog never holds a Processing step back.

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
