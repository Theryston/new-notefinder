import { compareText, compareTextNullsLast } from './compare.js';

describe('compareText', () => {
  it.each([
    ['a', 'b', -1],
    ['b', 'a', 1],
    ['a', 'a', 0],
    // By code unit, not by locale: uppercase sorts before lowercase.
    ['B', 'a', -1],
    ['2001', '2001-05', -1],
  ])('compares %j with %j as %i', (a, b, expected) => {
    expect(compareText(a, b)).toBe(expected);
  });
});

describe('compareTextNullsLast', () => {
  it.each([
    ['a', 'b', -1],
    ['b', 'a', 1],
    ['a', 'a', 0],
    ['a', null, -1],
    [null, 'a', 1],
    [null, null, 0],
  ])('compares %j with %j as %i', (a, b, expected) => {
    expect(compareTextNullsLast(a, b)).toBe(expected);
  });
});
