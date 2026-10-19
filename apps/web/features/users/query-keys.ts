/**
 * TanStack Query keys for the Profile's favorite songs grid. One infinite key
 * per Profile plus page size; the cursor travels as the page param, so every
 * page of one Profile shares the key and the cache stays per Profile.
 */
export const profileKeys = {
  all: ['users'] as const,
  favorites: (username: string) =>
    [...profileKeys.all, username, 'favorites'] as const,
  infiniteFavorites: (username: string, limit: number) =>
    [...profileKeys.favorites(username), 'infinite', { limit }] as const,
};
