/** Find the next local day boundary, including offset and DST transitions. */
export function nextPracticeDayDelay(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): number {
  const calendar = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = calendar.format(now);
  let before = now.getTime();
  let after = before + 36 * 3_600_000;
  // A local day can last 23 or 25 hours. Searching the calendar boundary
  // avoids assuming a fixed offset or asking the browser to change zones.
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (calendar.format(middle) === today) before = middle;
    else after = middle;
  }
  return after - now.getTime();
}
