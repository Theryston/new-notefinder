'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import {
  type FollowListSide,
  followListInfiniteQueryOptions,
} from '../follow-list-query';

/** The pages of one follow list of a Profile, loaded as the user scrolls. */
export function useFollowList(username: string, side: FollowListSide) {
  return useInfiniteQuery(followListInfiniteQueryOptions(username, side));
}
