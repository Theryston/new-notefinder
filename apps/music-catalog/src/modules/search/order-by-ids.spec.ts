import { orderByIds } from './order-by-ids.js';

type Row = { mbid: string; title: string };

const row = (mbid: string): Row => ({ mbid, title: `Title of ${mbid}` });
const mbidOf = (r: Row) => r.mbid;

describe('orderByIds', () => {
  it('puts the rows in the order of the ids, whatever order the database returned them in', () => {
    const rows = [row('a'), row('b'), row('c'), row('d')];

    const ordered = orderByIds(['c', 'a', 'd', 'b'], rows, mbidOf);

    expect(ordered.map(mbidOf)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('drops the ids that have no row, without moving the others', () => {
    const rows = [row('a'), row('c')];

    const ordered = orderByIds(['c', 'gone', 'a', 'also-gone'], rows, mbidOf);

    expect(ordered.map(mbidOf)).toEqual(['c', 'a']);
  });

  it('returns the very rows it was given', () => {
    const rows = [row('a'), row('b')];

    const [first, second] = orderByIds(['b', 'a'], rows, mbidOf);

    expect(first).toBe(rows[1]);
    expect(second).toBe(rows[0]);
  });

  it('ignores rows nobody asked for', () => {
    const ordered = orderByIds(['b'], [row('a'), row('b'), row('c')], mbidOf);

    expect(ordered.map(mbidOf)).toEqual(['b']);
  });

  it('returns nothing for no ids', () => {
    expect(orderByIds([], [row('a')], mbidOf)).toEqual([]);
  });

  it('returns nothing when no row is left', () => {
    expect(orderByIds(['a', 'b'], [], mbidOf)).toEqual([]);
  });
});
