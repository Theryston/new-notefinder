import type { UserFavoriteSignal } from './home-personal.repository.js';
import type { UserTasteActivity } from './home-personal.repository.types.js';
import type { TasteSignal } from './home-personal-recommendations.js';

/** Keep each activity separate so its age decays before aggregation. */
export const tasteSignalsOf = (
  activities: UserTasteActivity[],
  favorites: UserFavoriteSignal[],
): TasteSignal[] => [
  ...activities.map((activity) => ({
    genres: activity.genres,
    artistKey: activity.artistKey,
    weight: 1,
    lastSignalAt: activity.createdAt,
  })),
  ...favorites.map((favorite) => ({
    genres: favorite.genres,
    artistKey: favorite.artistKey,
    weight: 1,
    lastSignalAt: favorite.createdAt,
  })),
];
