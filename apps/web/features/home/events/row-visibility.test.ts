import { describe, expect, it } from 'vitest';
import { rowCardGeometries, visibleRowItems } from './row-visibility';

const viewport = { width: 390, height: 844 };

const card = (
  id: string,
  position: number,
  rect: { top: number; bottom: number; left: number; right: number },
) => ({ id, position, ...rect });

describe('visibleRowItems', () => {
  it('keeps the cards on screen with their positions', () => {
    expect(
      visibleRowItems(
        [
          card('track-1', 0, { top: 100, bottom: 300, left: 16, right: 200 }),
          card('track-2', 1, { top: 100, bottom: 300, left: 216, right: 400 }),
        ],
        viewport,
      ),
    ).toEqual([
      { id: 'track-1', position: 0 },
      { id: 'track-2', position: 1 },
    ]);
  });

  it('drops the cards outside the viewport', () => {
    expect(
      visibleRowItems(
        [
          card('above', 0, { top: -300, bottom: -10, left: 16, right: 200 }),
          card('below', 1, { top: 900, bottom: 1100, left: 16, right: 200 }),
          card('left', 2, { top: 100, bottom: 300, left: -400, right: -16 }),
          card('shown', 3, { top: 100, bottom: 300, left: 16, right: 200 }),
        ],
        viewport,
      ),
    ).toEqual([{ id: 'shown', position: 3 }]);
  });

  it('keeps a card that only peeks into the viewport', () => {
    expect(
      visibleRowItems(
        [card('peeking', 4, { top: 800, bottom: 900, left: 16, right: 200 })],
        viewport,
      ),
    ).toEqual([{ id: 'peeking', position: 4 }]);
  });
});

describe('rowCardGeometries', () => {
  const rect = (top: number, bottom: number) => ({
    top,
    bottom,
    left: 16,
    right: 200,
  });

  const card = (
    id: string | undefined,
    position: string | undefined,
    top: number,
    bottom: number,
  ) => ({
    dataset: {
      ...(id === undefined ? {} : { homeItemId: id }),
      ...(position === undefined ? {} : { homeItemPosition: position }),
    },
    getBoundingClientRect: () => rect(top, bottom),
  });

  it('reads the cards of a row element in DOM order', () => {
    const rowElement = {
      querySelectorAll: (selector: string) => {
        expect(selector).toBe('[data-home-item-id]');
        return [card('track-1', '0', 100, 300), card('track-2', '1', 100, 300)];
      },
    };

    expect(rowCardGeometries(rowElement)).toEqual([
      {
        id: 'track-1',
        position: 0,
        top: 100,
        bottom: 300,
        left: 16,
        right: 200,
      },
      {
        id: 'track-2',
        position: 1,
        top: 100,
        bottom: 300,
        left: 16,
        right: 200,
      },
    ]);
  });

  it('falls back to the DOM index for a missing or invalid position', () => {
    const rowElement = {
      querySelectorAll: () => [
        card('track-1', undefined, 100, 300),
        card(undefined, 'nope', 100, 300),
      ],
    };

    expect(rowCardGeometries(rowElement)).toEqual([
      {
        id: 'track-1',
        position: 0,
        top: 100,
        bottom: 300,
        left: 16,
        right: 200,
      },
      { id: '', position: 1, top: 100, bottom: 300, left: 16, right: 200 },
    ]);
  });
});
