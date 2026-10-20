'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { followListActionMutation } from '../follow-list-changes';
import type { FollowListSide } from '../follow-list-query';

/**
 * Removes a follower of the Profile, or unfollows a User from one of its lists.
 * The row leaves the open list at once and comes back if the request fails,
 * with a toast translated from the API's error code. The mutation is in
 * `follow-list-changes.ts`.
 */
export function useFollowListAction(username: string, side: FollowListSide) {
  return useMutation(
    followListActionMutation({
      queryClient: useQueryClient(),
      username,
      side,
      translate: useTranslations('errors'),
      notify: toast.error,
    }),
  );
}
