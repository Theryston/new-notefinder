import { viewWindowStarts } from './view-windows.js';

describe('viewWindowStarts', () => {
  it('starts each window at the beginning of its calendar unit, in UTC', () => {
    // Wednesday 2026-10-14.
    const starts = viewWindowStarts(new Date('2026-10-14T15:42:31.250Z'));

    expect(starts.hour.toISOString()).toBe('2026-10-14T15:00:00.000Z');
    expect(starts.day.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(starts.week.toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(starts.month.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('puts the week start in the previous month when the month began mid-week', () => {
    // Thursday 2026-10-01: the week began on Sunday 2026-09-27.
    const starts = viewWindowStarts(new Date('2026-10-01T00:30:00.000Z'));

    expect(starts.week.toISOString()).toBe('2026-09-27T00:00:00.000Z');
    expect(starts.month.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('starts the week today when today is Sunday', () => {
    const starts = viewWindowStarts(new Date('2026-10-11T23:59:59.999Z'));

    expect(starts.week.toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });

  it('does not change the date it is given', () => {
    const now = new Date('2026-10-14T15:42:31.250Z');

    viewWindowStarts(now);

    expect(now.toISOString()).toBe('2026-10-14T15:42:31.250Z');
  });
});
