/** TanStack Query keys of the daily practice streak. */
export const streakKeys = {
  all: ['streak'] as const,
  status: (timeZone: string) =>
    [...streakKeys.all, 'status', timeZone] as const,
};
