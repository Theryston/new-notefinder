import { compareTextNullsLast } from '../../lib/compare.js';
import { formatPartialDate } from '../../lib/partial-date.js';
import type { ReleaseEventRow } from './recording-data.js';

// The date formatting is shared with the release group's representative
// release (a sibling module), so it lives in lib/; re-exported for this file's
// callers.
export { formatPartialDate };

type FormattedEvent = { date: string | null; country: string | null };

// Dated events first, earliest first: the partial dates sort as text, since
// "2001" < "2001-05" < "2001-05-10". Ties go to the smaller country code, so
// the answer does not depend on the order the database returned the rows in.
const compareEvents = (a: FormattedEvent, b: FormattedEvent): number =>
  compareTextNullsLast(a.date, b.date) ||
  compareTextNullsLast(a.country, b.country);

/**
 * The date and country a release is shown with: its earliest release event,
 * or nothing when it has none.
 */
export const pickReleaseEvent = (
  events: readonly ReleaseEventRow[],
): FormattedEvent => {
  const [earliest] = events
    .map((event) => ({
      date: formatPartialDate(event),
      country: event.country,
    }))
    .sort(compareEvents);
  return earliest ?? { date: null, country: null };
};
