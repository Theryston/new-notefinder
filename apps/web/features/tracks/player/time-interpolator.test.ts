import { describe, expect, it } from 'vitest';

import {
  MAX_EXTRAPOLATION_SECONDS,
  SEEK_SETTLE_MS,
  TimeInterpolator,
} from './time-interpolator';

const playing = (reported: number, now: number, rate = 1) => ({
  reported,
  now,
  playing: true,
  rate,
});

describe('TimeInterpolator', () => {
  it('stays on the reported time while paused', () => {
    const clock = new TimeInterpolator();

    expect(clock.read({ reported: 12, now: 0, playing: false, rate: 1 })).toBe(
      12,
    );
    expect(
      clock.read({ reported: 12, now: 5000, playing: false, rate: 1 }),
    ).toBe(12);
  });

  it('moves with the wall clock between two coarse reports', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(10, 1000));

    expect(clock.read(playing(10, 1100))).toBeCloseTo(10.1, 5);
    expect(clock.read(playing(10, 1250))).toBeCloseTo(10.25, 5);
  });

  it('scales the movement by the playback rate', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(10, 1000, 0.5));

    expect(clock.read(playing(10, 1400, 0.5))).toBeCloseTo(10.2, 5);
  });

  it('re-anchors on a new report, jumping forward when it is ahead', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(10, 1000));
    clock.read(playing(10, 1200));

    expect(clock.read(playing(10.5, 1300))).toBeCloseTo(10.5, 5);
    expect(clock.read(playing(10.5, 1400))).toBeCloseTo(10.6, 5);
  });

  it('does not step back for a report slightly behind the clock', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(10, 1000));
    const ahead = clock.read(playing(10, 1250));

    const next = clock.read(playing(10.2, 1260));

    expect(next).toBeGreaterThanOrEqual(ahead);
  });

  it('follows a report far behind the clock, as after a seek back', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(60, 1000));

    expect(clock.read(playing(5, 1100))).toBeCloseTo(5, 5);
  });

  it('stops running ahead of a player that stopped reporting', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(10, 1000));

    expect(clock.read(playing(10, 60_000))).toBeCloseTo(
      10 + MAX_EXTRAPOLATION_SECONDS,
      5,
    );
  });

  it('starts over at a seek target', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(10, 1000));

    clock.reset(40, 2000);

    expect(clock.read(playing(40, 2100))).toBeCloseTo(40.1, 5);
  });

  it('does not snap back to the time before a seek while the player catches up', () => {
    const clock = new TimeInterpolator();
    clock.read(playing(30, 1000));
    clock.reset(90, 1100);

    // YouTube keeps reporting 30 for a few reads after seekTo(90).
    const reads = [1150, 1250, 1400, 1500].map((now) =>
      clock.read(playing(30, now)),
    );

    for (const read of reads) expect(read).toBeGreaterThanOrEqual(90);
    expect(reads.at(-1)).toBeLessThan(91);
    // Once the player reaches the target, its reports are followed again.
    expect(clock.read(playing(90.4, 1600))).toBeCloseTo(90.4, 5);
    expect(clock.read(playing(90.4, 1700))).toBeCloseTo(90.5, 5);
  });

  it('holds the target while paused and the player still reports the old time', () => {
    const clock = new TimeInterpolator();
    clock.read({ reported: 30, now: 0, playing: false, rate: 1 });
    clock.reset(90, 100);

    expect(
      clock.read({ reported: 30, now: 400, playing: false, rate: 1 }),
    ).toBe(90);
  });

  it('believes the player again if a seek never lands', () => {
    const clock = new TimeInterpolator();
    clock.reset(90, 0);

    expect(clock.read(playing(30, 500))).toBeGreaterThanOrEqual(90);
    expect(clock.read(playing(30, SEEK_SETTLE_MS + 100))).toBeCloseTo(30, 5);
  });

  it('carries on from the clock when playback starts during a seek', () => {
    const clock = new TimeInterpolator();
    clock.read({ reported: 30, now: 0, playing: false, rate: 1 });
    clock.reset(90, 100);

    expect(clock.read(playing(30, 300))).toBeCloseTo(90, 5);
    expect(clock.read(playing(30, 500))).toBeCloseTo(90.2, 5);
  });

  it('re-anchors when playback resumes', () => {
    const clock = new TimeInterpolator();
    clock.read({ reported: 10, now: 0, playing: false, rate: 1 });

    expect(clock.read(playing(10, 4000))).toBeCloseTo(10, 5);
    expect(clock.read(playing(10, 4200))).toBeCloseTo(10.2, 5);
  });
});
