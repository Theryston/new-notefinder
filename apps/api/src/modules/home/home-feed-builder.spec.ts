import { Test } from '@nestjs/testing';
import { HomeFeedBuilder } from './home-feed-builder.service.js';
import {
  HOME_ROW_SOURCES,
  type HomeCandidate,
  type HomeRowSource,
} from './home-row-sources.js';

const candidate = (
  id: string,
  overrides: Partial<HomeCandidate> = {},
): HomeCandidate => ({
  id,
  title: `Track ${id}`,
  coverUrl: `https://cdn.example/${id}.webp`,
  artistCredit: [{ name: `Artist ${id}`, joinPhrase: '' }],
  durationMs: 180_000,
  vocalRange: { lowest: 60, highest: 72 },
  artistKey: `artist-${id}`,
  hasCover: true,
  isCompleted: true,
  ...overrides,
});

const candidates = (count: number, prefix = 't'): HomeCandidate[] =>
  Array.from({ length: count }, (_, i) => candidate(`${prefix}${i}`));

const trendingSource = (items: HomeCandidate[]): HomeRowSource => ({
  id: 'trending-today',
  layout: 'standard',
  title: { key: 'home.rows.trendingToday', params: {} },
  load: async () => items,
});

const heroSource = (items: HomeCandidate[]): HomeRowSource => ({
  id: 'hero',
  layout: 'hero',
  load: async () => items,
});

const buildWith = async (sources: HomeRowSource[]) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      HomeFeedBuilder,
      { provide: HOME_ROW_SOURCES, useValue: sources },
    ],
  }).compile();
  return moduleRef.get(HomeFeedBuilder).build();
};

describe('HomeFeedBuilder', () => {
  it('builds a public feed with a hero first, then the standard rows', async () => {
    const feed = await buildWith([
      heroSource(candidates(1, 'h')),
      trendingSource(candidates(6)),
    ]);

    expect(feed).toMatchObject({
      audience: 'public',
      algorithmVersion: 1,
      rows: [
        { id: 'hero', layout: 'hero' },
        { id: 'trending-today', layout: 'standard' },
      ],
    });
  });

  it('answers a 16-character version', async () => {
    const feed = await buildWith([trendingSource(candidates(6))]);
    expect(feed.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it('keeps the version while the content is the same', async () => {
    const first = await buildWith([trendingSource(candidates(6))]);
    const second = await buildWith([trendingSource(candidates(6))]);
    expect(second.version).toBe(first.version);
  });

  it('changes the version when a row changes', async () => {
    const first = await buildWith([trendingSource(candidates(6))]);
    const second = await buildWith([trendingSource(candidates(6, 'x'))]);
    expect(second.version).not.toBe(first.version);
  });

  it('maps a Track to the public card, without the composer fields or the artist MBID', async () => {
    const withMbid = candidate('t0', {
      artistCredit: [{ name: 'Artist', joinPhrase: ' & ', mbid: 'mbid-1' }],
    });
    const feed = await buildWith([
      trendingSource([withMbid, ...candidates(5, 'r')]),
    ]);
    const [row] = feed.rows;
    expect(row).toMatchObject({ layout: 'standard' });
    const [item] = row?.layout === 'standard' ? row.items : [];
    expect(item).toEqual({
      id: 't0',
      title: 'Track t0',
      coverUrl: 'https://cdn.example/t0.webp',
      artistCredit: [{ name: 'Artist', joinPhrase: ' & ' }],
      durationMs: 180_000,
      vocalRange: { lowest: 60, highest: 72 },
    });
  });

  it('never marks a row sponsored', async () => {
    const feed = await buildWith([
      heroSource(candidates(1, 'h')),
      trendingSource(candidates(6)),
    ]);
    for (const row of feed.rows) {
      expect(row).not.toHaveProperty('sponsored');
    }
  });

  it('leaves out a row that is below its minimum size', async () => {
    const feed = await buildWith([trendingSource(candidates(3))]);
    expect(feed.rows).toEqual([]);
  });
});
