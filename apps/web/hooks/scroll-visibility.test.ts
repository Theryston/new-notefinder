import { describe, expect, it } from 'vitest';

import { nextScrollVisibility } from './scroll-visibility';

const HEADER = 64;

describe('nextScrollVisibility', () => {
  it('hides the header when scrolling down past it', () => {
    expect(
      nextScrollVisibility({ hidden: false, anchorY: 100 }, 200, HEADER),
    ).toEqual({ hidden: true, anchorY: 200 });
  });

  it('shows it again when scrolling up', () => {
    expect(
      nextScrollVisibility({ hidden: true, anchorY: 500 }, 400, HEADER),
    ).toEqual({ hidden: false, anchorY: 400 });
  });

  it('always shows it near the top, even scrolling down', () => {
    expect(
      nextScrollVisibility({ hidden: true, anchorY: 0 }, HEADER, HEADER),
    ).toEqual({ hidden: false, anchorY: HEADER });
  });

  it('ignores movements under the threshold', () => {
    const previous = { hidden: true, anchorY: 500 };
    expect(nextScrollVisibility(previous, 493, HEADER)).toBe(previous);
    expect(nextScrollVisibility(previous, 507, HEADER)).toBe(previous);
  });

  it('flips at exactly the threshold', () => {
    expect(
      nextScrollVisibility({ hidden: false, anchorY: 500 }, 508, HEADER),
    ).toEqual({ hidden: true, anchorY: 508 });
    expect(
      nextScrollVisibility({ hidden: true, anchorY: 500 }, 492, HEADER),
    ).toEqual({ hidden: false, anchorY: 492 });
  });

  it('accumulates slow scrolling from the anchor', () => {
    let state = { hidden: false, anchorY: 100 };
    for (const y of [104, 108, 112]) {
      state = nextScrollVisibility(state, y, HEADER);
    }
    expect(state).toEqual({ hidden: true, anchorY: 108 });
  });
});
