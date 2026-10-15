import { describe, expect, it } from 'vitest';

import {
  BLACK_KEY_WIDTH,
  keyboardLayout,
  WHITE_KEY_WIDTH,
} from './keyboard-layout';

describe('keyboardLayout', () => {
  it('spans from the C below the range to the B of its highest octave', () => {
    const { keys, width } = keyboardLayout({ lowest: 62, highest: 74 });
    const midis = keys.map((key) => key.midi).sort((a, b) => a - b);

    // C4 to B5: D4 to D5 reaches into the fifth octave.
    expect(midis[0]).toBe(60);
    expect(midis.at(-1)).toBe(83);
    expect(width).toBe(14 * WHITE_KEY_WIDTH);
  });

  it('shows at least two octaves, even for one note', () => {
    const { keys } = keyboardLayout({ lowest: 60, highest: 60 });

    expect(keys).toHaveLength(24);
  });

  it('marks the keys of the range, sharps included', () => {
    const { keys } = keyboardLayout({ lowest: 62, highest: 66 });
    const inRange = keys.filter((key) => key.inRange).map((key) => key.midi);

    expect(inRange.sort((a, b) => a - b)).toEqual([62, 63, 64, 65, 66]);
  });

  it('lists the white keys first so the black ones draw over them', () => {
    const { keys } = keyboardLayout({ lowest: 60, highest: 71 });
    const firstBlack = keys.findIndex((key) => key.black);

    expect(keys.slice(firstBlack).every((key) => key.black)).toBe(true);
    expect(keys.slice(0, firstBlack).every((key) => !key.black)).toBe(true);
  });

  it('centers a black key on the edge of the white key before it', () => {
    const { keys } = keyboardLayout({ lowest: 60, highest: 71 });
    const cSharp = keys.find((key) => key.midi === 61);

    expect(cSharp?.x).toBe(WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2);
  });

  it('stays on the MIDI scale at the very top', () => {
    const { keys } = keyboardLayout({ lowest: 126, highest: 127 });

    expect(Math.max(...keys.map((key) => key.midi))).toBe(127);
    expect(Math.min(...keys.map((key) => key.midi))).toBeGreaterThanOrEqual(0);
  });
});
