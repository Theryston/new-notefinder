import type { SearchResultItem } from '@vozzify/contracts';
import { describe, expect, it } from 'vitest';

import { suggestionPanelContent } from './suggestion-panel';

const first = {
  mbid: '00000000-0000-4000-8000-000000000001',
} as SearchResultItem;
const second = {
  mbid: '00000000-0000-4000-8000-000000000002',
} as SearchResultItem;

describe('suggestionPanelContent', () => {
  it('lists nothing and says nothing before the first answer', () => {
    expect(suggestionPanelContent(undefined)).toEqual({
      items: [],
      noSongs: false,
    });
  });

  it('keeps the rows in the order they arrived', () => {
    expect(suggestionPanelContent([first, second])).toEqual({
      items: [first, second],
      noSongs: false,
    });
  });

  it('reports no songs for a settled empty answer', () => {
    expect(suggestionPanelContent([])).toEqual({ items: [], noSongs: true });
  });
});
