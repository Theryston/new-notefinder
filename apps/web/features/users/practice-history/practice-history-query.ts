'use client';

import {
  type PracticeAttemptHistoryItem,
  type PracticeAttemptHistoryPage,
  practiceAttemptHistoryPageSchema,
} from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';
import { cursorPagesQueryOptions } from '@/lib/cursor-pages-query';

import { practiceHistoryKey } from '../query-keys';
import { PRACTICE_HISTORY_PAGE_SIZE } from './practice-history-keys';

/**
 * The Profile's history as shared cursor paging: the server-rendered first
 * page hydrates the cache, and "Show more" fetches the next one from the API.
 */
export function practiceHistoryQueryOptions({
  username,
  initialPage,
}: {
  username: string;
  initialPage?: PracticeAttemptHistoryPage;
}) {
  return cursorPagesQueryOptions<PracticeAttemptHistoryItem>({
    queryKey: practiceHistoryKey(username),
    fetchPage: ({ cursor, signal }) =>
      browserApi(`/users/${encodeURIComponent(username)}/attempts`, {
        schema: practiceAttemptHistoryPageSchema,
        query: { cursor, limit: PRACTICE_HISTORY_PAGE_SIZE },
        signal,
      }),
    initialPage,
  });
}
