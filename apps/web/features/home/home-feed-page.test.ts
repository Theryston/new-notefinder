import { homeFeedPageSchema } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

const track = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  coverUrl: 'https://coverartarchive.org/release/1/front',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 354000,
  vocalRange: { lowest: 40, highest: 69 },
};

const standardRow = {
  id: 'new-tracks',
  layout: 'standard',
  title: { key: 'home.rows.newTracks', params: {} },
  items: [track],
};

const page = (rows: unknown[], overrides: Record<string, unknown> = {}) => ({
  audience: 'public',
  version: 'a1b2c3d4e5f60718',
  algorithmVersion: 1,
  rows,
  nextCursor: null,
  ...overrides,
});

describe('homeFeedPageSchema', () => {
  it('keeps the rows of a layout it knows, in feed order', () => {
    const parsed = homeFeedPageSchema.parse(
      page([{ id: 'hero', layout: 'hero', track }, standardRow]),
    );

    expect(parsed.rows.map((row) => row.id)).toEqual(['hero', 'new-tracks']);
  });

  it('skips a row whose layout is unknown, without failing the page', () => {
    const parsed = homeFeedPageSchema.parse(
      page([
        { id: 'top-10', layout: 'ranked-top-10', title: {}, items: [track] },
        standardRow,
      ]),
    );

    expect(parsed.rows).toEqual([
      expect.objectContaining({ id: 'new-tracks' }),
    ]);
  });

  it('skips a known layout whose shape does not match, such as an empty carousel', () => {
    const parsed = homeFeedPageSchema.parse(
      page([{ ...standardRow, id: 'empty', items: [] }, standardRow]),
    );

    expect(parsed.rows.map((row) => row.id)).toEqual(['new-tracks']);
  });

  it('keeps the sponsored flag on a row that carries it', () => {
    const parsed = homeFeedPageSchema.parse(
      page([{ ...standardRow, sponsored: true }]),
    );

    expect(parsed.rows[0]).toMatchObject({ sponsored: true });
  });

  it('keeps the audience as sent, so the public cache can refuse another one', () => {
    const parsed = homeFeedPageSchema.parse(
      page([standardRow], { audience: 'personal' }),
    );

    expect(parsed.audience).toBe('personal');
  });

  it('rejects a response without a version', () => {
    const body = page([standardRow]);
    const { version: _version, ...withoutVersion } = body;

    expect(homeFeedPageSchema.safeParse(withoutVersion).success).toBe(false);
  });
});
