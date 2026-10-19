import type { z } from 'zod';

import { catalogTrackSchema } from './artists.js';
import { cursorPageSchema } from './pagination.js';

// A User's favorite Tracks on their public Profile:
// `GET /v1/users/:username/favorites`, anonymous like the banner.

/**
 * One cursor page of a User's favorite Tracks, newest favorited first. Each
 * item is the catalog Track the Profile's cover grid shows; only Tracks with a
 * completed Processing are listed, as every catalog read does. Query params
 * are `cursorPaginationQuerySchema`.
 */
export const userFavoritesPageSchema = cursorPageSchema(catalogTrackSchema);

export type UserFavoritesPage = z.infer<typeof userFavoritesPageSchema>;
