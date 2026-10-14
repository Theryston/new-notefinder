/** Where each trending window starts; all of them end now. */
export type ViewWindowStarts = {
  hour: Date;
  day: Date;
  week: Date;
  month: Date;
};

/**
 * The calendar windows of the trending score, in UTC so every instance agrees:
 * the start of this hour, day, week (Sunday, as the legacy app's default
 * locale had it) and month.
 */
export function viewWindowStarts(now: Date): ViewWindowStarts {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  const day = new Date(hour);
  day.setUTCHours(0);
  const week = new Date(day);
  week.setUTCDate(day.getUTCDate() - day.getUTCDay());
  const month = new Date(day);
  month.setUTCDate(1);
  return { hour, day, week, month };
}
