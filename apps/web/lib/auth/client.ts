import { emailOTPClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { getClientEnv } from '@/lib/env/client';

function createClient() {
  return createAuthClient({
    // Better Auth is served by the API under /v1/auth. The client sends
    // cookies cross-origin (`credentials: 'include'`) by default.
    baseURL: `${getClientEnv().NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/v1/auth`,
    plugins: [emailOTPClient(), usernameClient({ displayUsername: false })],
  });
}

export type AuthClient = ReturnType<typeof createClient>;

let client: AuthClient | undefined;

/**
 * Better Auth client for sign in/up/out, email codes and usernames, used by
 * client components. Created on first use so importing it never requires the
 * env (e.g. during `next build`). Its responses use Better Auth's format,
 * not the API error envelope.
 */
export function getAuthClient(): AuthClient {
  client ??= createClient();
  return client;
}
