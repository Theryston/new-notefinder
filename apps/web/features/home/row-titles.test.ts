import { describe, expect, it } from 'vitest';

import { HOME_ROW_TITLE_KEYS, isHomeRowTitleKey } from './row-titles';

describe('isHomeRowTitleKey', () => {
  it.each(HOME_ROW_TITLE_KEYS)('accepts the known title key %s', (key) => {
    expect(isHomeRowTitleKey(key)).toBe(true);
  });

  it.each([
    'home.rows.rankedTopTen',
    'home.rows',
    '',
    'home.rows.trendingToday.extra',
  ])('refuses the unknown title key "%s", so its row is hidden', (key) => {
    expect(isHomeRowTitleKey(key)).toBe(false);
  });
});
