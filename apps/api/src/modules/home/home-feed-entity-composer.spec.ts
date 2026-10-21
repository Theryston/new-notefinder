import {
  type ComposableEntity,
  composeEntityRows,
} from './home-feed-composer.js';

type Entity = ComposableEntity & { name: string };

const entity = (id: string): Entity => ({ id, name: `Entity ${id}` });

const entities = (count: number, prefix = 'e'): Entity[] =>
  Array.from({ length: count }, (_, i) => entity(`${prefix}${i}`));

const idsOf = (rows: { items: readonly Entity[] }[]) =>
  rows.map((row) => row.items.map((item) => item.id));

describe('composeEntityRows', () => {
  it('keeps the order and metadata of the candidate rows', () => {
    const rows = composeEntityRows([
      {
        id: 'genres',
        layout: 'genres' as const,
        title: { key: 'home.rows.genres', params: {} },
        items: entities(6),
      },
      {
        id: 'featured-artists',
        layout: 'artists' as const,
        title: { key: 'home.rows.featuredArtists', params: {} },
        items: entities(6, 'a'),
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual(['genres', 'featured-artists']);
    expect(rows[0]?.items[0]).toEqual(entity('e0'));
  });

  it('shows an entity once per feed: the earlier row keeps it', () => {
    const shared = entities(6);
    const rows = composeEntityRows([
      {
        id: 'first',
        layout: 'genres' as const,
        title: { key: 'home.rows.genres', params: {} },
        items: shared,
      },
      {
        id: 'second',
        layout: 'genres' as const,
        title: { key: 'home.rows.genres', params: {} },
        items: shared,
      },
    ]);

    expect(idsOf(rows)).toEqual([['e0', 'e1', 'e2', 'e3', 'e4', 'e5']]);
  });

  it('frees the entities of a dropped row for the rows after it', () => {
    const shared = entities(3);
    const rows = composeEntityRows([
      {
        id: 'too-few',
        layout: 'genres' as const,
        title: { key: 'home.rows.genres', params: {} },
        items: shared,
      },
      {
        id: 'enough',
        layout: 'artists' as const,
        title: { key: 'home.rows.featuredArtists', params: {} },
        items: [...shared, ...entities(6, 'a')],
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual(['enough']);
    expect(rows[0]?.items.map((item) => item.id)).toEqual([
      'e0',
      'e1',
      'e2',
      'a0',
      'a1',
      'a2',
      'a3',
      'a4',
      'a5',
    ]);
  });

  it('drops a row with fewer than six entries', () => {
    const rows = composeEntityRows([
      {
        id: 'genres',
        layout: 'genres' as const,
        title: { key: 'home.rows.genres', params: {} },
        items: entities(5),
      },
    ]);

    expect(rows).toEqual([]);
  });

  it('keeps at most twelve entries in one row', () => {
    const [row] = composeEntityRows([
      {
        id: 'genres',
        layout: 'genres' as const,
        title: { key: 'home.rows.genres', params: {} },
        items: entities(20),
      },
    ]);

    expect(row?.items).toHaveLength(12);
  });
});
