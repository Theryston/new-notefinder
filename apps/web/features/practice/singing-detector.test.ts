import { describe, expect, it } from 'vitest';
import { FORGET_AFTER } from './pitch/post-process';
import { SingingDetector } from './singing-detector';

function feed(detector: SingingDetector, readings: (number | null)[]) {
  let singing = false;
  for (const midi of readings) singing = detector.push(midi);
  return singing;
}

describe('SingingDetector', () => {
  it('is not singing before any voice is heard', () => {
    expect(feed(new SingingDetector(), [null, null])).toBe(false);
  });

  it('is singing on the reading that has a voice', () => {
    expect(feed(new SingingDetector(), [64])).toBe(true);
  });

  it('keeps singing through a breath, up to the readings the smoothing forgets after', () => {
    const detector = new SingingDetector();
    expect(feed(detector, [64])).toBe(true);
    expect(feed(detector, Array(FORGET_AFTER - 1).fill(null))).toBe(true);
    expect(detector.push(null)).toBe(false);
  });

  it('stops singing once the voice has been silent for too long', () => {
    expect(
      feed(new SingingDetector(), [64, ...Array(FORGET_AFTER).fill(null)]),
    ).toBe(false);
  });

  it('starts singing again as soon as a voice comes back', () => {
    const detector = new SingingDetector();
    feed(detector, [64, ...Array(FORGET_AFTER).fill(null)]);
    expect(detector.push(62)).toBe(true);
  });
});
