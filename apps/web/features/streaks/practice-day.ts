/** The browser's calendar day follows its local zone, including DST changes. */
export function nextPracticeDayDelay(now = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}
