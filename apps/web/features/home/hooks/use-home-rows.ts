'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { HomeFeedPage, Locale } from '@vozzify/contracts';

import { homeRowsQueryOptions } from '../home-rows-query';

/** The home's rows, paged from the server-rendered first page. */
export function useHomeRows(locale: Locale, initialPage: HomeFeedPage) {
  return useInfiniteQuery(homeRowsQueryOptions(locale, initialPage));
}
