import {
  creditHeartbeat,
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

describe('creditHeartbeat', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  const msAgo = (ms: number) => new Date(now.getTime() - ms);
  const credit = (elapsedSeconds: number, sinceMs: number | null) =>
    creditHeartbeat({
      elapsedSeconds,
      lastHeartbeatAt: sinceMs === null ? null : msAgo(sinceMs),
      now,
    });

  it('credits what was reported on the first heartbeat, up to the cap', () => {
    expect(credit(5, null).creditedSeconds).toBe(5);
    expect(credit(5.9, null).creditedSeconds).toBe(5);
    expect(credit(20, null).creditedSeconds).toBe(20);
    expect(credit(300, null).creditedSeconds).toBe(20);
    expect(credit(0, null).creditedSeconds).toBe(0);
    expect(credit(5, null).clockAt).toEqual(now);
  });

  it('credits at most the time the server clock saw pass, rounded', () => {
    expect(credit(20, 3_000).creditedSeconds).toBe(3);
    expect(credit(20, 3_400).creditedSeconds).toBe(3);
    expect(credit(20, 3_600).creditedSeconds).toBe(4);
    expect(credit(5, 60_000).creditedSeconds).toBe(5);
    expect(credit(20, 60_000).creditedSeconds).toBe(20);
  });

  it('credits a 5 s heartbeat that is a few milliseconds early in full', () => {
    expect(credit(5, 4_990).creditedSeconds).toBe(5);
  });

  it('credits nothing to heartbeats a few milliseconds apart', () => {
    expect(credit(5, 10).creditedSeconds).toBe(0);
    expect(credit(5, 0).creditedSeconds).toBe(0);
  });

  it('credits nothing for a heartbeat stamped in the future', () => {
    expect(credit(5, -10_000).creditedSeconds).toBe(0);
  });

  it('moves the clock by the seconds credited when the clock limited them', () => {
    const result = credit(20, 3_400);

    expect(result.clockAt).toEqual(msAgo(3_400 - 3_000));
  });

  it('moves the clock to now when the report limited the credit', () => {
    expect(credit(5, 60_000).clockAt).toEqual(now);
  });

  it('does not pay twice for bursts: half-second calls share the real time', () => {
    let clock = new Date(0);
    let total = 0;
    for (let ms = 500; ms <= 10_000; ms += 500) {
      const result = creditHeartbeat({
        elapsedSeconds: 20,
        lastHeartbeatAt: clock,
        now: new Date(ms),
      });
      total += result.creditedSeconds;
      clock = result.clockAt;
    }

    expect(total).toBeLessThanOrEqual(10);
  });
});
