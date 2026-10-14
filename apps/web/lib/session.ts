import { queryOptions } from '@tanstack/react-query';

/** Shared session cache key so features can react to the signed-in User. */
export const sessionUserQueryKey = ['auth', 'session'] as const;

/** What auth screens and features need to know about the signed-in User. */
export type SessionUser = {
  name: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  image?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Parse Better Auth's `{ session, user }` answer, or return null if signed out. */
export function parseSessionUser(body: unknown): SessionUser | null {
  if (!isRecord(body) || !isRecord(body.user)) return null;
  const { name, email, emailVerified, username, image } = body.user;
  if (typeof email !== 'string') return null;
  return {
    name: typeof name === 'string' ? name : '',
    email,
    emailVerified: emailVerified === true,
    username: typeof username === 'string' && username ? username : null,
    image: typeof image === 'string' && image ? image : undefined,
  };
}

/** The signed-in User, or null when signed out. */
export async function fetchSessionUser(
  signal?: AbortSignal,
): Promise<SessionUser | null> {
  const { getClientEnv } = await import('@/lib/env/client');
  const apiUrl = getClientEnv().NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const response = await fetch(`${apiUrl}/v1/auth/get-session`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) {
    throw new Error(`Session lookup failed (${response.status})`);
  }
  return parseSessionUser(await response.json());
}

export function sessionUserOptions() {
  return queryOptions({
    queryKey: sessionUserQueryKey,
    queryFn: ({ signal }) => fetchSessionUser(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
