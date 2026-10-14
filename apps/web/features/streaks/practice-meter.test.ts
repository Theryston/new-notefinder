import { describe, expect, it } from 'vitest';

import { createPracticeMeter } from './practice-meter';

describe('createPracticeMeter', () => {
  it('counts nothing while the music is not playing', () => {
    const meter = createPracticeMeter();

    expect(meter.take(60_000)).toBe(0);
  });

  it('counts the whole seconds of playing time', () => {
    const meter = createPracticeMeter();
    meter.setPlaying(true, 1_000);

    expect(meter.take(6_000)).toBe(5);
  });

  it('keeps the fraction of a second for the next take', () => {
    const meter = createPracticeMeter();
    meter.setPlaying(true, 0);

    expect(meter.take(5_400)).toBe(5);
    expect(meter.take(10_700)).toBe(5);
    expect(meter.take(11_000)).toBe(1);
  });

  it('stops counting on pause and keeps what was played', () => {
    const meter = createPracticeMeter();
    meter.setPlaying(true, 0);
    meter.setPlaying(false, 3_500);

    expect(meter.take(60_000)).toBe(3);
    expect(meter.take(120_000)).toBe(0);
  });

  it('adds up several playing stretches', () => {
    const meter = createPracticeMeter();
    meter.setPlaying(true, 0);
    meter.setPlaying(false, 2_500);
    meter.setPlaying(true, 10_000);

    expect(meter.take(12_500)).toBe(5);
  });

  it('ignores a repeated state', () => {
    const meter = createPracticeMeter();
    meter.setPlaying(true, 0);
    meter.setPlaying(true, 4_000);
    meter.setPlaying(false, 6_000);
    meter.setPlaying(false, 9_000);

    expect(meter.take(20_000)).toBe(6);
  });
});
