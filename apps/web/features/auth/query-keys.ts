export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  usernameAvailability: (username: string) =>
    [...authKeys.all, 'username-availability', username] as const,
};
