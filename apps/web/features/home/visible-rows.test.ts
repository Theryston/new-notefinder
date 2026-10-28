import type { HomeRow } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

import { uniqueRows, visibleRows } from './visible-rows';

const track = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: null,
  vocalRange: null,
};

const hero = (id: string): HomeRow => ({ id, layout: 'hero', track });

const carousel = (id: string): HomeRow => ({
  id,
  layout: 'standard',
  title: { key: 'home.rows.newTracks', params: {} },
  items: [track],
});

const isKnown = (layout: HomeRow['layout']) => layout !== 'hero';

describe('uniqueRows', () => {
  it('keeps the first row of each id, in feed order', () => {
    const rows = [hero('a'), carousel('b'), carousel('a')];

    expect(uniqueRows(rows)).toEqual([hero('a'), carousel('b')]);
  });
});

describe('visibleRows', () => {
  it('drops the rows of a layout the web does not render', () => {
    expect(visibleRows([hero('a'), carousel('b')], isKnown)).toEqual([
      carousel('b'),
    ]);
  });

  it('filters before the caller takes the first row, so that row is the first visible one', () => {
    const [first] = visibleRows([hero('a'), carousel('b')], isKnown);

    expect(first?.id).toBe('b');
  });

  it('also removes repeated ids', () => {
    expect(visibleRows([carousel('b'), carousel('b')], () => true)).toEqual([
      carousel('b'),
    ]);
  });
});
