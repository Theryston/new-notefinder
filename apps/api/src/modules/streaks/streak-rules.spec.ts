import {
  creditedSecondsOf,
  currentStreakDays,
  localDayOf,
  previousDay,
} from './streak-rules.js';

describe('localDayOf', () => {
  const instant = new Date('2026-03-10T02:30:00Z');

  it('reads the calendar day in the zone, not in UTC', () => {
    expect(localDayOf(instant, 'UTC')).toBe('2026-03-10');
    expect(localDayOf(instant, 'America/Sao_Paulo')).toBe('2026-03-09');
    expect(localDayOf(instant, 'Asia/Tokyo')).toBe('2026-03-10');
  });

  it('rolls over at local midnight', () => {
    const before = new Date('2026-03-10T02:59:59Z');
    const after = new Date('2026-03-10T03:00:00Z');

    expect(localDayOf(before, 'America/Sao_Paulo')).toBe('2026-03-09');
    expect(localDayOf(after, 'America/Sao_Paulo')).toBe('2026-03-10');
  });
});

describe('previousDay', () => {
  it('crosses month and year ends', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
  });
});

describe('currentStreakDays', () => {
  const days = (...list: string[]) => new Set(list);

  it('is 0 without a completed day today or yesterday', () => {
    expect(currentStreakDays(days(), '2026-03-10')).toBe(0);
    expect(currentStreakDays(days('2026-03-08'), '2026-03-10')).toBe(0);
  });

  it('counts the run ending today', () => {
    expect(
      currentStreakDays(
        days('2026-03-10', '2026-03-09', '2026-03-08'),
        '2026-03-10',
      ),
    ).toBe(3);
  });

  it('keeps the run ending yesterday while today is open', () => {
    expect(
      currentStreakDays(days('2026-03-09', '2026-03-08'), '2026-03-10'),
    ).toBe(2);
  });

  it('stops at the first gap', () => {
    expect(
      currentStreakDays(
        days('2026-03-10', '2026-03-09', '2026-03-07'),
        '2026-03-10',
      ),
    ).toBe(2);
  });
});

describe('creditedSecondsOf', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  const secondsAgo = (seconds: number) =>
    new Date(now.getTime() - seconds * 1000);

  it('credits what was reported on the first heartbeat, up to the cap', () => {
    const credit = (elapsedSeconds: number) =>
      creditedSecondsOf({ elapsedSeconds, lastHeartbeatAt: null, now });

    expect(credit(5)).toBe(5);
    expect(credit(5.9)).toBe(5);
    expect(credit(20)).toBe(20);
    expect(credit(300)).toBe(20);
    expect(credit(0)).toBe(0);
  });

  it('credits at most the time the server clock saw pass', () => {
    const credit = (elapsed: number, since: number) =>
      creditedSecondsOf({
        elapsedSeconds: elapsed,
        lastHeartbeatAt: secondsAgo(since),
        now,
      });

    expect(credit(20, 3)).toBe(3);
    expect(credit(20, 3.9)).toBe(3);
    expect(credit(20, 0)).toBe(0);
    expect(credit(5, 60)).toBe(5);
    expect(credit(20, 60)).toBe(20);
  });

  it('credits nothing for a heartbeat stamped in the future', () => {
    expect(
      creditedSecondsOf({
        elapsedSeconds: 5,
        lastHeartbeatAt: secondsAgo(-10),
        now,
      }),
    ).toBe(0);
  });
});
