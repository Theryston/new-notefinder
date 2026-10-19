import 'server-only';

import {
  type PracticeAttemptHistoryPage,
  practiceAttemptHistoryPageSchema,
} from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server';

import { PRACTICE_HISTORY_PAGE_SIZE } from './practice-history-page-size';

/**
 * The first page of a Profile's history, read on each request: runs change as
 * soon as a User practices, so the history is not cached. `undefined` when the
 * API cannot answer, so the list falls back to a browser request and says so
 * in place rather than failing the Profile. `null` when the owner hid the
 * section from visitors, which the section then leaves out.
 */
export async function getPracticeHistoryFirstPage(
  username: string,
): Promise<PracticeAttemptHistoryPage | null | undefined> {
  return readFirstPage(username, false);
}

/**
 * The same page as the signed-in owner reads it: the request's cookies identify
 * the owner, so a section the owner hid comes back too. Reads the request.
 */
export async function getOwnPracticeHistoryFirstPage(
  username: string,
): Promise<PracticeAttemptHistoryPage | null | undefined> {
  return readFirstPage(username, true);
}

async function readFirstPage(
  username: string,
  forwardCookies: boolean,
): Promise<PracticeAttemptHistoryPage | null | undefined> {
  return serverApi(`/users/${encodeURIComponent(username)}/attempts`, {
    schema: practiceAttemptHistoryPageSchema,
    query: { limit: PRACTICE_HISTORY_PAGE_SIZE },
    forwardCookies,
  }).catch((error: unknown) =>
    isApiError(error) && error.code === 'NOT_FOUND' ? null : undefined,
  );
}
