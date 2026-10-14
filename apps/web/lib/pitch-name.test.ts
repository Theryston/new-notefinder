import { nearestKey, pitchName } from '@notefinder/contracts';
import { describe, expect, it } from 'vitest';

describe('nearestKey', () => {
  it('rounds a pitch to the closest key', () => {
    expect(nearestKey(69)).toBe(69);
    expect(nearestKey(60.4)).toBe(60);
    expect(nearestKey(60.6)).toBe(61);
  });

  it('sends a pitch halfway between two keys to the higher one', () => {
    expect(nearestKey(59.5)).toBe(60);
    expect(nearestKey(61.5)).toBe(62);
    expect(nearestKey(-0.5)).toBe(0);
  });
});

describe('pitchName', () => {
  it('names whole pitches, sharps with #', () => {
    expect(pitchName(69)).toBe('A4');
    expect(pitchName(61)).toBe('C#4');
    expect(pitchName(0)).toBe('C-1');
  });

  it('names a fractional pitch after its nearest key', () => {
    expect(pitchName(60.4)).toBe('C4');
    expect(pitchName(60.6)).toBe('C#4');
  });

  it('crosses the octave at the halfway pitch', () => {
    expect(pitchName(71.4)).toBe('B4');
    expect(pitchName(71.5)).toBe('C5');
    expect(pitchName(59.5)).toBe('C4');
    expect(pitchName(59.4)).toBe('B3');
  });

  it('names negative pitches', () => {
    expect(pitchName(-0.5)).toBe('C-1');
    expect(pitchName(-0.6)).toBe('B-2');
    expect(pitchName(-13)).toBe('B-3');
  });
});
