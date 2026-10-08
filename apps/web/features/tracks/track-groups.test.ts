import { describe, expect, it } from 'vitest';

import { groupTracksByHeading } from './track-groups';

type Item = { id: string; disc: string | null };

const item = (id: string, disc: string | null): Item => ({ id, disc });
const byDisc = (track: Item) => track.disc;

describe('groupTracksByHeading', () => {
  it('returns one headingless group without a groupBy', () => {
    const items = [item('a', '1'), item('b', '2')];

    expect(groupTracksByHeading(items)).toEqual([{ heading: null, items }]);
  });

  it('returns no groups for no items', () => {
    expect(groupTracksByHeading([], byDisc)).toEqual([]);
  });

  it('shows no heading when every item is in one group', () => {
    const items = [item('a', 'Disc 1'), item('b', 'Disc 1')];

    expect(groupTracksByHeading(items, byDisc)).toEqual([
      { heading: null, items },
    ]);
  });

  it('starts a heading group at each group change', () => {
    const first = item('a', 'Disc 1');
    const second = item('b', 'Disc 1');
    const third = item('c', 'Disc 2');

    expect(groupTracksByHeading([first, second, third], byDisc)).toEqual([
      { heading: 'Disc 1', items: [first, second] },
      { heading: 'Disc 2', items: [third] },
    ]);
  });

  it('keeps the heading of a group that a later page continues', () => {
    const pageOne = [item('a', 'Disc 1'), item('b', 'Disc 1')];
    const pageTwo = [item('c', 'Disc 1'), item('d', 'Disc 2')];

    const groups = groupTracksByHeading([...pageOne, ...pageTwo], byDisc);

    expect(groups.map((group) => group.heading)).toEqual(['Disc 1', 'Disc 2']);
    expect(groups[0]?.items.map((track) => track.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves items without a heading out of the heading groups', () => {
    const untitled = item('a', null);
    const titled = item('b', 'Disc 1');

    expect(groupTracksByHeading([untitled, titled], byDisc)).toEqual([
      { heading: null, items: [untitled] },
      { heading: 'Disc 1', items: [titled] },
    ]);
  });

  it('does not mutate the items it was given', () => {
    const items = [item('a', 'Disc 1'), item('b', 'Disc 2')];

    groupTracksByHeading(items, byDisc);

    expect(items.map((track) => track.id)).toEqual(['a', 'b']);
  });
});
