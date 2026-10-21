// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { clickTargetOf } from './home-click';

const meta = new Map([
  ['row-0', { feedVersion: 'a1b2c3d4e5f60718', algorithmVersion: 1 }],
]);

const row = (inner: string): HTMLElement => {
  const section = document.createElement('section');
  section.dataset.homeRowId = 'row-0';
  section.innerHTML = inner;
  document.body.appendChild(section);
  return section;
};

describe('clickTargetOf', () => {
  it('targets a carousel card with its row and position', () => {
    const section = row(
      '<a href="/en/tracks/track-2" data-home-item-id="track-2" ' +
        'data-home-item-position="1">track</a>',
    );
    const link = section.querySelector('a') as HTMLAnchorElement;

    expect(clickTargetOf(link, meta)).toEqual({
      rowId: 'row-0',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
      itemId: 'track-2',
      position: 1,
    });
    section.remove();
  });

  it('targets a hero call to action without a position', () => {
    const section = row(
      '<a href="/en/tracks/track-9" data-home-item-id="track-9">sing</a>',
    );
    const link = section.querySelector('a') as HTMLAnchorElement;

    expect(clickTargetOf(link, meta)).toEqual({
      rowId: 'row-0',
      feedVersion: 'a1b2c3d4e5f60718',
      algorithmVersion: 1,
      itemId: 'track-9',
    });
    section.remove();
  });

  it('ignores a click from inside the card', () => {
    const section = row(
      '<a href="/en/tracks/track-2" data-home-item-id="track-2" ' +
        'data-home-item-position="1"><span>track</span></a>',
    );
    const inner = section.querySelector('span') as HTMLElement;

    expect(clickTargetOf(inner, meta)).toMatchObject({ itemId: 'track-2' });
    section.remove();
  });

  it('ignores links outside a tracked row', () => {
    document.body.innerHTML =
      '<a href="/en/search" id="outside">search</a>' +
      '<section data-home-row-id="row-unknown">' +
      '<a href="/en/tracks/x" data-home-item-id="x">x</a></section>';
    const outside = document.querySelector('#outside') as HTMLAnchorElement;
    const unknown = document.querySelector(
      '[data-home-row-id="row-unknown"] a',
    ) as HTMLAnchorElement;

    expect(clickTargetOf(outside, meta)).toBeUndefined();
    expect(clickTargetOf(unknown, meta)).toBeUndefined();
    expect(clickTargetOf(null, meta)).toBeUndefined();
    document.body.innerHTML = '';
  });
});
