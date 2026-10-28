import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { benefitKeys } from './query-keys';

describe('Benefit administration cache isolation', () => {
  it('keeps deletion impact isolated by Benefit while allowing catalog-wide invalidation', async () => {
    const client = new QueryClient();
    const keys = [
      benefitKeys.catalog(),
      benefitKeys.plans(),
      benefitKeys.deletionImpact('cloud'),
      benefitKeys.deletionImpact('scoring'),
    ];
    for (const [index, key] of keys.entries()) client.setQueryData(key, index);
    expect(keys.map((key) => client.getQueryData(key))).toEqual([0, 1, 2, 3]);
    await client.invalidateQueries({
      queryKey: benefitKeys.deletionImpact('cloud'),
    });
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      [false, false, true, false],
    );
    await client.invalidateQueries({ queryKey: benefitKeys.all });
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      [true, true, true, true],
    );
    client.clear();
  });
});
