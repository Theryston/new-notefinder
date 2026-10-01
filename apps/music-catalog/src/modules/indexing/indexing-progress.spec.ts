import { indexingPercent } from './indexing-progress.js';

describe('indexingPercent', () => {
  it('starts at zero and ends at one hundred', () => {
    expect(indexingPercent(0, 4)).toBe(0);
    expect(indexingPercent(4, 4)).toBe(100);
  });

  it('rounds to whole percent', () => {
    expect(indexingPercent(1, 3)).toBe(33);
    expect(indexingPercent(2, 3)).toBe(67);
  });

  it('treats an empty catalog as fully indexed instead of dividing by zero', () => {
    expect(indexingPercent(0, 0)).toBe(100);
  });

  it('clamps progress that overshoots the total', () => {
    expect(indexingPercent(9, 4)).toBe(100);
  });
});
