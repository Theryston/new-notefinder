/** A MusicBrainz date: any part of it may be unknown. */
export type PartialDate = {
  year: number | null;
  month: number | null;
  day: number | null;
};

const pad = (value: number, length: number): string =>
  String(value).padStart(length, '0');

/**
 * A MusicBrainz date as `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, keeping the
 * precision it was entered with. Without a year there is no date: MusicBrainz
 * does not record a month or day alone. As text, a less precise date sorts
 * first when it starts the same period ("2001" < "2001-05" < "2001-05-10").
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
