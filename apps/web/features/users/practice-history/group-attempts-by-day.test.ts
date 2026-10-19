import { describe, expect, it } from 'vitest';

import { groupAttemptsByDay } from './group-attempts-by-day';

// Newest first, as the history lists them. The first two runs are half an
// hour apart across midnight UTC; the third is a day earlier.
const attempts = [
  { id: 'late', createdAt: '2026-10-19T00:30:00.000Z' },
  { id: 'before-midnight', createdAt: '2026-10-18T23:30:00.000Z' },
  { id: 'noon', createdAt: '2026-10-18T12:00:00.000Z' },
];

const idsByDay = (timeZone: string) =>
  groupAttemptsByDay(attempts, timeZone).map((group) => ({
    day: group.day,
    ids: group.attempts.map((attempt) => attempt.id),
  }));

describe('groupAttemptsByDay', () => {
  it('reads the day in UTC', () => {
    expect(idsByDay('UTC')).toEqual([
      { day: '2026-10-19', ids: ['late'] },
      { day: '2026-10-18', ids: ['before-midnight', 'noon'] },
    ]);
  });

  it('keeps a run before UTC midnight on the same day in a time zone behind UTC', () => {
    // São Paulo is UTC-3: 00:30 UTC is 21:30 the day before, so all three
    // runs share one day.
    expect(idsByDay('America/Sao_Paulo')).toEqual([
      { day: '2026-10-18', ids: ['late', 'before-midnight', 'noon'] },
    ]);
  });

  it('moves a run to the next day in a time zone ahead of UTC', () => {
    // Tokyo is UTC+9: 23:30 UTC is already 08:30 on the 19th.
    expect(idsByDay('Asia/Tokyo')).toEqual([
      { day: '2026-10-19', ids: ['late', 'before-midnight'] },
      { day: '2026-10-18', ids: ['noon'] },
    ]);
  });

  it('answers no groups for an empty history', () => {
    expect(groupAttemptsByDay([], 'UTC')).toEqual([]);
  });
});
