import 'server-only';

import {
  type PracticeAttemptHistoryPage,
  practiceAttemptHistoryPageSchema,
} from '@notefinder/contracts';

import { serverApi } from '@/lib/api/server';

import { PRACTICE_HISTORY_PAGE_SIZE } from './practice-history-keys';

/**
 * The first page of a Profile's history, read on each request: runs change as
 * soon as a User practices, so the history is not cached. `undefined` when the
 * API cannot answer, so the list falls back to a browser request and says so
 * in place rather than failing the Profile.
 */
export async function getPracticeHistoryFirstPage(
  username: string,
): Promise<PracticeAttemptHistoryPage | undefined> {
  return serverApi(`/users/${encodeURIComponent(username)}/attempts`, {
    schema: practiceAttemptHistoryPageSchema,
    query: { limit: PRACTICE_HISTORY_PAGE_SIZE },
  }).catch(() => undefined);
}
