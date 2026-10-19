'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  applyFollowChange,
  followErrorCode,
  rollbackFollowChange,
  settleFollowChange,
} from '../follow-changes';
import { setFollow } from '../follow-query';

/**
 * Follows or unfollows the Profile's User. The button and the follower count
 * change at once and go back when the request fails, with a toast translated
 * from the API's error code. The cache logic is in `follow-changes.ts`.
 */
export function useProfileFollow(username: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('errors');

  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) =>
      setFollow(userId, follow),
    onMutate: ({ follow }) => applyFollowChange(queryClient, username, follow),
    onError: (error, _change, snapshot) => {
      rollbackFollowChange(queryClient, username, snapshot);
      toast.error(t(followErrorCode(error)));
    },
    onSettled: () => settleFollowChange(queryClient, username),
  });
}
