import { describe, expect, it } from 'vitest';

import { practiceHistoryKey } from './query-keys';

describe('practiceHistoryKey', () => {
  it('builds a stable key per Profile', () => {
    expect(practiceHistoryKey('ada_lovelace')).toEqual([
      'users',
      'ada_lovelace',
      'practice-history',
    ]);
  });

  it('keeps two Profiles apart', () => {
    expect(practiceHistoryKey('ada_lovelace')).not.toEqual(
      practiceHistoryKey('grace'),
    );
  });
});
