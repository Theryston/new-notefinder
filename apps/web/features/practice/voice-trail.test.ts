import { describe, expect, it, vi } from 'vitest';

import { VoiceTrail } from './voice-trail';

describe('VoiceTrail', () => {
  it('joins readings that follow each other into one line', () => {
    const trail = new VoiceTrail();
    trail.push(1, 60);
    trail.push(1.05, 61);
    trail.push(1.1, 62);
    expect(trail.segments(0, 5)).toEqual([
      [
        { time: 1, midi: 60 },
        { time: 1.05, midi: 61 },
        { time: 1.1, midi: 62 },
      ],
    ]);
  });

  it('leaves a gap where nothing is voiced instead of joining across it', () => {
    const trail = new VoiceTrail();
    trail.push(1, 60);
    trail.push(1.05, 60);
    trail.push(1.1, null);
    trail.push(1.5, 64);
    trail.push(1.55, 64);
    expect(trail.segments(0, 5)).toHaveLength(2);
  });

  it('keeps a lone reading as a stretch of its own', () => {
    const trail = new VoiceTrail();
    trail.push(1, 60);
    expect(trail.segments(0, 5)).toEqual([[{ time: 1, midi: 60 }]]);
  });

  it('returns only the stretches that touch the visible time', () => {
    const trail = new VoiceTrail();
    trail.push(1, 60);
    trail.push(10, 62);
    expect(trail.segments(9, 12)).toEqual([[{ time: 10, midi: 62 }]]);
    expect(trail.segments(2, 8)).toEqual([]);
  });

  it('forgets what it drew ahead when the Track is sought back', () => {
    const trail = new VoiceTrail();
    trail.push(10, 60);
    trail.push(10.05, 60);
    trail.push(2, 64);
    expect(trail.segments(0, 20)).toEqual([[{ time: 2, midi: 64 }]]);
  });

  it('does not forget on a tiny step back', () => {
    const trail = new VoiceTrail();
    trail.push(10, 60);
    trail.push(9.9, 61);
    expect(trail.segments(0, 20)[0]).toHaveLength(2);
  });

  it('remembers the latest reading, voiced or not', () => {
    const trail = new VoiceTrail();
    trail.push(1, 60.4);
    expect(trail.latest()).toBe(60.4);
    trail.push(1.1, null);
    expect(trail.latest()).toBeNull();
    trail.setLatest(65);
    expect(trail.latest()).toBe(65);
  });

  it('caps what it keeps', () => {
    const trail = new VoiceTrail();
    for (let i = 0; i < 1600; i += 1) trail.push(i * 0.01, 60);
    const points = trail.segments(0, 100).flat();
    expect(points).toHaveLength(1500);
    expect(points[0]?.time).toBeCloseTo(1);
  });

  it('tells subscribers about every change until they leave', () => {
    const trail = new VoiceTrail();
    const listener = vi.fn();
    const leave = trail.subscribe(listener);
    trail.push(1, 60);
    trail.setLatest(61);
    trail.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    leave();
    trail.push(2, 60);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('clears the line and the latest reading', () => {
    const trail = new VoiceTrail();
    trail.push(1, 60);
    trail.clear();
    expect(trail.segments(0, 5)).toEqual([]);
    expect(trail.latest()).toBeNull();
  });
});
