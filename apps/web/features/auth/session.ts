import * as sharedSession from '@/lib/session';

export type { SessionUser } from '@/lib/session';

export const parseSessionUser = (body: unknown) =>
  sharedSession.parseSessionUser(body);

export function fetchSessionUser(signal?: AbortSignal) {
  return sharedSession.fetchSessionUser(signal);
}

export function sessionUserOptions() {
  return sharedSession.sessionUserOptions();
}
