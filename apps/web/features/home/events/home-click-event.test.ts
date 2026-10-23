import { describe, expect, it } from 'vitest';
import { buildClickEvent } from './events-sender';

describe('home click event attribution', () => {
  it('carries the generated click id with the clicked item', () => {
    expect(
      buildClickEvent({
        rowId: 'row-0',
        feedVersion: 'a1b2c3d4e5f60718',
        algorithmVersion: 1,
        itemId: 'track-2',
        clickId: 'click-1',
      }),
    ).toEqual({
      type: 'home.item_click',
      rowId: 'row-0',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
      itemId: 'track-2',
      clickId: 'click-1',
    });
  });
});
