import {
  getOrCreateVisitorId as getSharedVisitorId,
  VISITOR_ID_KEY as SHARED_VISITOR_ID_KEY,
} from '@/lib/visitor-id';

export const VISITOR_ID_KEY = SHARED_VISITOR_ID_KEY;

/** The home events feature shares the same browser identifier as sign-up. */
export function getOrCreateVisitorId(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): string {
  return getSharedVisitorId(storage);
}
