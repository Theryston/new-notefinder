import { describe, expect, it } from 'vitest';
import { rowMetaOf } from './tracked-rows';

describe('rowMetaOf', () => {
  it('maps every row to the version it was read from', () => {
    expect(
      rowMetaOf([
        {
          version: 'version-1',
          algorithmVersion: 1,
          rows: [{ id: 'row-0', items: [] }],
        },
        {
          version: 'version-2',
          algorithmVersion: 2,
          rows: [{ id: 'row-1', items: [] }],
        },
      ]),
    ).toEqual(
      new Map([
        ['row-0', { feedVersion: 'version-1', algorithmVersion: 1 }],
        ['row-1', { feedVersion: 'version-2', algorithmVersion: 2 }],
      ]),
    );
  });

  it('maps no rows of no pages', () => {
    expect(rowMetaOf([])).toEqual(new Map());
  });
});
