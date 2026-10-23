import {
  getOrCreateVisitorId as getSharedVisitorId,
  VISITOR_ID_KEY as SHARED_VISITOR_ID_KEY,
} from '@/lib/visitor-id';

/** The anonymous visitor id used by home events and Track views. */
export const VISITOR_ID_KEY = SHARED_VISITOR_ID_KEY;

/** The stored visitor id, or a fresh one stored for the next page load. */
export function getOrCreateVisitorId(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): string {
  return getSharedVisitorId(storage);
}
