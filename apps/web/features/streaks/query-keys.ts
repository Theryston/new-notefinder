/** TanStack Query keys of the daily practice streak. */
export const streakKeys = {
  all: ['streak'] as const,
  status: (timeZone: string, account?: string) =>
    account === undefined
      ? ([...streakKeys.all, 'status', timeZone] as const)
      : ([...streakKeys.all, 'status', account, timeZone] as const),
};
