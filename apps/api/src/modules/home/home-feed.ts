import { homeRowSchema } from '@notefinder/contracts';
import { z } from 'zod';
import { HOME_ALGORITHM_VERSION } from './home-rules.js';

/**
 * A feed as it is stored in Redis: the response minus the cursor, which is
 * per request. Its `version` is a hash of the rows, so an unchanged feed keeps
 * its version and its paging cursors.
 */
export const storedHomeFeedSchema = z.object({
  audience: z.literal('public'),
  version: z.string().min(1).max(64),
  algorithmVersion: z.number().int().positive(),
  rows: z.array(homeRowSchema),
});

export type StoredHomeFeed = z.infer<typeof storedHomeFeedSchema>;

/**
 * The fallback for a request that finds no feed while another request builds
 * it: an empty home, never stored and never cached.
 */
export const minimalHomeFeed = (): StoredHomeFeed => ({
  audience: 'public',
  version: 'minimal',
  algorithmVersion: HOME_ALGORITHM_VERSION,
  rows: [],
});
