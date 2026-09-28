import type { AuthClient } from '@/lib/auth/client';

/**
 * The Better Auth client, loaded on first use: it (and its dependencies)
 * would otherwise weigh on the first load of every auth page, which only
 * need it once the user submits something.
 */
export async function loadAuthClient(): Promise<AuthClient> {
  const { getAuthClient } = await import('@/lib/auth/client');
  return getAuthClient();
}
