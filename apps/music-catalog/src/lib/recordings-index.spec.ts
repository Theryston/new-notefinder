import { SEARCH_MAX_LIMIT, SEARCH_MAX_OFFSET } from '@notefinder/contracts';
import {
  RECORDINGS_INDEX,
  RECORDINGS_INDEX_SETTINGS,
} from './recordings-index.js';

describe('the recordings index', () => {
  it('is named recordings and keyed by the MBID', () => {
    expect(RECORDINGS_INDEX).toEqual({ uid: 'recordings', primaryKey: 'mbid' });
  });

  it('searches the fields in the order of their weight: the title first, the disambiguation last', () => {
    expect(RECORDINGS_INDEX_SETTINGS.searchableAttributes).toEqual([
      'title',
      'artistCredit',
      'artistAliases',
      'releaseTitles',
      'workTitles',
      'genres',
      'disambiguation',
    ]);
  });

  it('lets a search reach every match the protocol lets a client page to', () => {
    const reachable = SEARCH_MAX_OFFSET + SEARCH_MAX_LIMIT;

    expect(RECORDINGS_INDEX_SETTINGS.pagination.maxTotalHits).toBe(reachable);
  });
});
