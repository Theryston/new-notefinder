import 'server-only';

import { getCurrentUser } from '@/lib/auth/session';

/**
 * Whether the signed-in viewer owns the Profile of `username`: only the owner
 * sees a section they hid. Reads the request, so call it inside `<Suspense>`
 * and only when a visitor could not see the section.
 */
export async function viewerOwnsProfile(username: string): Promise<boolean> {
  const viewer = await getCurrentUser();
  return viewer !== null && viewer.username === username;
}
