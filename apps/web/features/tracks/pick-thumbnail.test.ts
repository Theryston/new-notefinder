import { describe, expect, it } from 'vitest';

import { pickThumbnail } from './pick-thumbnail';

const thumb = (width: number | null) => ({
  url: `https://img.test/${width}`,
  width,
  height: width,
});

describe('pickThumbnail', () => {
  it('picks the smallest cover at least as wide as asked', () => {
    const covers = [thumb(544), thumb(60), thumb(226), thumb(120)];

    expect(pickThumbnail(covers, 200)).toEqual(thumb(226));
    expect(pickThumbnail(covers, 226)).toEqual(thumb(226));
    expect(pickThumbnail(covers, 1)).toEqual(thumb(60));
  });

  it('falls back to the widest when none is wide enough', () => {
    expect(pickThumbnail([thumb(60), thumb(120)], 400)).toEqual(thumb(120));
  });

  it('prefers covers with a known width', () => {
    expect(pickThumbnail([thumb(null), thumb(60)], 400)).toEqual(thumb(60));
  });

  it('uses a cover without a width when it is all there is', () => {
    expect(pickThumbnail([thumb(null)], 400)).toEqual(thumb(null));
  });

  it('returns nothing without covers', () => {
    expect(pickThumbnail([], 400)).toBeUndefined();
  });

  it('leaves the list it was given untouched', () => {
    const covers = [thumb(544), thumb(60)];

    pickThumbnail(covers, 100);

    expect(covers).toEqual([thumb(544), thumb(60)]);
  });
});
