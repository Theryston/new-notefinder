import { formatPartialDate } from './partial-date.js';

describe('formatPartialDate', () => {
  it.each([
    [{ year: 1975, month: 11, day: 21 }, '1975-11-21'],
    [{ year: 1975, month: 11, day: null }, '1975-11'],
    [{ year: 1975, month: null, day: null }, '1975'],
    // Zero padded, as ISO 8601 writes them.
    [{ year: 987, month: 3, day: 4 }, '0987-03-04'],
    [{ year: null, month: null, day: null }, null],
    // A month or day with no year says nothing.
    [{ year: null, month: 5, day: 6 }, null],
    // A day with no month is cut at the month.
    [{ year: 1999, month: null, day: 6 }, '1999'],
  ])('writes %j as %j', (date, expected) => {
    expect(formatPartialDate(date)).toBe(expected);
  });
});
