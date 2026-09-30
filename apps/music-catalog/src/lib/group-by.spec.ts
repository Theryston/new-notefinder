import { groupBy } from './group-by.js';

describe('groupBy', () => {
  it('collects the items under their key, keeping their order', () => {
    const groups = groupBy(
      [
        { key: 1, value: 'a' },
        { key: 2, value: 'b' },
        { key: 1, value: 'c' },
      ],
      (item) => item.key,
    );

    expect(groups.get(1)?.map((item) => item.value)).toEqual(['a', 'c']);
    expect(groups.get(2)?.map((item) => item.value)).toEqual(['b']);
  });

  it('has no entry for a key nothing has', () => {
    expect(groupBy([{ key: 1 }], (item) => item.key).get(2)).toBeUndefined();
  });

  it('has no groups for no items', () => {
    expect(groupBy([], (item: { key: number }) => item.key).size).toBe(0);
  });
});
