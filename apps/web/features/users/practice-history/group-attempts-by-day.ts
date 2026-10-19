/** A run of consecutive attempts that fall on the same calendar day. */
export type AttemptDayGroup<TAttempt> = {
  /** The calendar day as `YYYY-MM-DD` in the time zone the groups were cut in. */
  day: string;
  attempts: TAttempt[];
};

/**
 * Cuts the attempts (newest first, as the history lists them) into one group
 * per calendar day, where the day is read in the viewer's time zone: a run
 * at 23:30 UTC is still the day before in São Paulo and already the next day
 * in Tokyo. Attempts of a day stay together because the list is ordered.
 */
export function groupAttemptsByDay<TAttempt extends { createdAt: string }>(
  attempts: readonly TAttempt[],
  timeZone: string,
): AttemptDayGroup<TAttempt>[] {
  const calendar = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const groups: AttemptDayGroup<TAttempt>[] = [];
  for (const attempt of attempts) {
    const day = calendar.format(new Date(attempt.createdAt));
    const last = groups.at(-1);
    if (last?.day === day) {
      last.attempts.push(attempt);
    } else {
      groups.push({ day, attempts: [attempt] });
    }
  }
  return groups;
}
