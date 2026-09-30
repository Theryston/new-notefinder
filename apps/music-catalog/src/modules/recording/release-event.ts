import { compareTextNullsLast } from '../../lib/compare.js';
import type { ReleaseEventRow } from './recording-data.js';

type PartialDate = Pick<ReleaseEventRow, 'year' | 'month' | 'day'>;

const pad = (value: number, length: number): string =>
  String(value).padStart(length, '0');

/**
 * A MusicBrainz date as `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, keeping the
 * precision it was entered with. Without a year there is no date: MusicBrainz
 * does not record a month or day alone.
 */
export const formatPartialDate = ({
  year,
  month,
  day,
}: PartialDate): string | null => {
  if (year === null) {
    return null;
  }
  if (month === null) {
    return pad(year, 4);
  }
  const yearAndMonth = `${pad(year, 4)}-${pad(month, 2)}`;
  return day === null ? yearAndMonth : `${yearAndMonth}-${pad(day, 2)}`;
};

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
