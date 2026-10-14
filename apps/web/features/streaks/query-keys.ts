/** TanStack Query keys of the daily practice streak. */
export const streakKeys = {
  all: ['streak'] as const,
  status: () => [...streakKeys.all, 'status'] as const,
};
