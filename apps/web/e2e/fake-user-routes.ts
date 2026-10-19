import { userAttemptsRoute } from './fake-user-attempts.ts';
import { userFavoritesRoute } from './fake-user-favorites.ts';
import { userProfileRoute } from './fake-user-profile.ts';

/** The reads of a Profile: its banner, favorite songs and practice history. */
export const userRoutes = [
  userProfileRoute,
  userFavoritesRoute,
  userAttemptsRoute,
];
