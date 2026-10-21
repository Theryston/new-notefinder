import type {
  EditorialPinHistoryPage,
  EditorialPinPage,
} from '@notefinder/contracts';
import { queryOptions } from '@tanstack/react-query';

/** TanStack Query keys of the admin pins panel. */
export const adminPinKeys = {
  all: ['admin-home-pins'] as const,
  list: () => [...adminPinKeys.all, 'list'] as const,
  history: (pinId: string) => [...adminPinKeys.all, pinId, 'history'] as const,
};

/**
 * Every pin, newest first. The fetcher (and its contracts schemas) loads on
 * the first read, so Zod stays out of the page's first-load JavaScript.
 */
export function adminPinsQueryOptions() {
  return queryOptions({
    queryKey: adminPinKeys.list(),
    queryFn: async ({ signal }): Promise<EditorialPinPage> => {
      const { fetchAdminPins } = await import('./admin-pins-client');
      return fetchAdminPins(signal);
    },
    retry: false,
  });
}

/** Who created and changed a pin and when. */
export function adminPinHistoryQueryOptions(pinId: string) {
  return queryOptions({
    queryKey: adminPinKeys.history(pinId),
    queryFn: async ({ signal }): Promise<EditorialPinHistoryPage> => {
      const { fetchAdminPinHistory } = await import('./admin-pins-client');
      return fetchAdminPinHistory(pinId, signal);
    },
    retry: false,
  });
}
