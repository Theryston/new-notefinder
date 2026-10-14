import { sessionUserQueryKey } from '@/lib/session';

export const authKeys = {
  all: ['auth'] as const,
  session: () => sessionUserQueryKey,
  usernameAvailability: (username: string) =>
    [...authKeys.all, 'username-availability', username] as const,
};
