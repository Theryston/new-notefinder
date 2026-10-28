'use client';

import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { TrackContributorsPage } from '@vozzify/contracts';

import {
  setContributorFollow,
  withContributorFollow,
} from '../contributor-follow';
import { trackKeys } from '../query-keys';

type ContributorPages = InfiniteData<TrackContributorsPage>;

/**
 * Follows or unfollows a Contributor of the Track. The row's button changes at
 * once in every cached page of the list, and the pages go back as they were
 * when the request fails. The row reads the outcome from the mutation.
 */
export function useContributorFollow(trackId: string) {
  const queryClient = useQueryClient();
  const filter = { queryKey: trackKeys.contributorsAll(trackId) };

  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) =>
      setContributorFollow(userId, follow),
    onMutate: async ({ userId, follow }) => {
      // A list read in flight would land after the change and undo it.
      await queryClient.cancelQueries(filter);
      const snapshot = queryClient.getQueriesData<ContributorPages>(filter);
      queryClient.setQueriesData<ContributorPages>(filter, (data) =>
        withContributorFollow(data, userId, follow),
      );
      return { snapshot };
    },
    onError: (_error, _change, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
  });
}
