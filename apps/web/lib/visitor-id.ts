/** The anonymous visitor id: a random id kept in the browser's local storage
 * (no cookie), sent with events and Track views. */
export const VISITOR_ID_KEY = 'notefinder:visitor-id';

type IdStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The stored visitor id, or a fresh one stored for the next page load. */
export function getOrCreateVisitorId(storage: IdStorage): string {
  const existing = storage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(VISITOR_ID_KEY, created);
  return created;
}
