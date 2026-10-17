import { describe, expect, it } from 'vitest';

import {
  type ComboboxEvent,
  type ComboboxIntent,
  type ComboboxState,
  initialComboboxState,
  updateCombobox,
} from './combobox-state-machine';

// Two suggestions plus the trailing "Search for" row.
const ITEM_COUNT = 3;
const openWith = (highlighted: number | null): ComboboxState => ({
  open: true,
  highlighted,
});

const update = (
  state: ComboboxState,
  event: ComboboxEvent,
  itemCount = ITEM_COUNT,
) => updateCombobox(state, event, itemCount);

const expectNoop = (
  state: ComboboxState,
  event: ComboboxEvent,
  itemCount = ITEM_COUNT,
) =>
  expect(update(state, event, itemCount)).toEqual({
    state,
    intent: { kind: 'none' },
  });

describe('combobox-state-machine', () => {
  it('starts closed with nothing highlighted', () => {
    expect(initialComboboxState).toEqual({ open: false, highlighted: null });
  });

  it('reaches every documented intent kind', () => {
    const intents: ComboboxIntent[] = [
      update(initialComboboxState, {
        type: 'input-changed',
        query: 'queen',
      }).intent,
      update(openWith(null), { type: 'enter-pressed', query: 'queen' }).intent,
      update(openWith(0), { type: 'enter-pressed', query: 'queen' }).intent,
      update(openWith(0), { type: 'escape-pressed' }).intent,
      update(initialComboboxState, { type: 'escape-pressed' }).intent,
    ];
    expect(intents.map((intent) => intent.kind).sort()).toEqual(
      [
        'close-list',
        'collapse-field',
        'none',
        'open-suggestion',
        'submit-search',
      ].sort(),
    );
  });

  it('never mutates the state it is given', () => {
    const state = Object.freeze({ ...initialComboboxState });
    expect(() =>
      update(
        update(state, { type: 'input-changed', query: 'queen' }).state,
        { type: 'arrow-down' },
        ITEM_COUNT,
      ),
    ).not.toThrow();
    expect(state).toEqual(initialComboboxState);
  });

  describe('input-changed', () => {
    it('opens the list while the query is searchable', () => {
      expect(
        update(initialComboboxState, {
          type: 'input-changed',
          query: 'queen',
        }),
      ).toEqual({
        state: { open: true, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('keeps the list closed while the input is blank', () => {
      for (const query of ['', '   ']) {
        expect(
          update(initialComboboxState, { type: 'input-changed', query }),
        ).toEqual({
          state: { open: false, highlighted: null },
          intent: { kind: 'none' },
        });
      }
    });

    it('closes an open list and clears the highlight once blank', () => {
      expect(
        update(openWith(1), { type: 'input-changed', query: '  ' }),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('clears a highlight made stale by typing', () => {
      expect(
        update(openWith(1), { type: 'input-changed', query: 'queen f' }),
      ).toEqual({
        state: { open: true, highlighted: null },
        intent: { kind: 'none' },
      });
    });
  });

  describe('focused', () => {
    it('reopens the list with the cached suggestions', () => {
      expect(
        update(initialComboboxState, { type: 'focused', query: 'queen' }),
      ).toEqual({
        state: { open: true, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('keeps a blank field closed', () => {
      expect(
        update(initialComboboxState, { type: 'focused', query: '' }),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('closes an open list once the field is blank', () => {
      expect(update(openWith(2), { type: 'focused', query: '' })).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('leaves an open field and its highlight alone', () => {
      expect(update(openWith(1), { type: 'focused', query: 'queen' })).toEqual({
        state: { open: true, highlighted: 1 },
        intent: { kind: 'none' },
      });
    });
  });

  describe('blurred', () => {
    it('closes the list and clears the highlight, without navigating', () => {
      expect(update(openWith(1), { type: 'blurred' })).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('leaves a closed list closed', () => {
      expect(update(initialComboboxState, { type: 'blurred' })).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'none' },
      });
    });
  });

  describe('suggestions-arrived', () => {
    it('resets the highlight but keeps an open list open', () => {
      expect(update(openWith(2), { type: 'suggestions-arrived' })).toEqual({
        state: { open: true, highlighted: null },
        intent: { kind: 'none' },
      });
    });

    it('never reopens a list closed while loading', () => {
      expect(
        update(initialComboboxState, { type: 'suggestions-arrived' }),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'none' },
      });
    });
  });

  describe('arrow-down', () => {
    it('starts at the first row from nothing', () => {
      expect(update(openWith(null), { type: 'arrow-down' })).toEqual({
        state: { open: true, highlighted: 0 },
        intent: { kind: 'none' },
      });
    });

    it('steps to the next row', () => {
      expect(update(openWith(0), { type: 'arrow-down' })).toEqual({
        state: { open: true, highlighted: 1 },
        intent: { kind: 'none' },
      });
    });

    it('wraps from the last row back to the first', () => {
      expect(update(openWith(ITEM_COUNT - 1), { type: 'arrow-down' })).toEqual({
        state: { open: true, highlighted: 0 },
        intent: { kind: 'none' },
      });
    });

    it('wraps a single row onto itself', () => {
      expect(update(openWith(0), { type: 'arrow-down' }, 1)).toEqual({
        state: { open: true, highlighted: 0 },
        intent: { kind: 'none' },
      });
    });

    it('never opens a closed list', () => {
      expectNoop(initialComboboxState, { type: 'arrow-down' });
    });

    it('does nothing without rows', () => {
      expectNoop(openWith(null), { type: 'arrow-down' }, 0);
    });
  });

  describe('arrow-up', () => {
    it('starts at the last row from nothing', () => {
      expect(update(openWith(null), { type: 'arrow-up' })).toEqual({
        state: { open: true, highlighted: ITEM_COUNT - 1 },
        intent: { kind: 'none' },
      });
    });

    it('steps to the previous row', () => {
      expect(update(openWith(2), { type: 'arrow-up' })).toEqual({
        state: { open: true, highlighted: 1 },
        intent: { kind: 'none' },
      });
    });

    it('wraps from the first row to the last', () => {
      expect(update(openWith(0), { type: 'arrow-up' })).toEqual({
        state: { open: true, highlighted: ITEM_COUNT - 1 },
        intent: { kind: 'none' },
      });
    });

    it('never opens a closed list', () => {
      expectNoop(initialComboboxState, { type: 'arrow-up' });
    });

    it('does nothing without rows', () => {
      expectNoop(openWith(null), { type: 'arrow-up' }, 0);
    });
  });

  describe('escape-pressed', () => {
    it('closes the list and keeps focus on the first Escape', () => {
      expect(update(openWith(1), { type: 'escape-pressed' })).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'close-list' },
      });
    });

    it('closes a list with nothing highlighted too', () => {
      expect(update(openWith(null), { type: 'escape-pressed' })).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'close-list' },
      });
    });

    it('collapses the field on the second Escape', () => {
      expect(update(initialComboboxState, { type: 'escape-pressed' })).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'collapse-field' },
      });
    });
  });

  describe('enter-pressed', () => {
    it('does nothing on a blank field', () => {
      for (const query of ['', '   ']) {
        expect(
          update(initialComboboxState, { type: 'enter-pressed', query }),
        ).toEqual({
          state: { open: false, highlighted: null },
          intent: { kind: 'none' },
        });
      }
    });

    it('submits the search with nothing highlighted', () => {
      expect(
        update(openWith(null), { type: 'enter-pressed', query: 'queen' }),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'submit-search' },
      });
    });

    it('submits the search from a closed list too', () => {
      expect(
        update(
          initialComboboxState,
          { type: 'enter-pressed', query: 'queen' },
          0,
        ),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'submit-search' },
      });
    });

    it('opens the highlighted suggestion', () => {
      expect(
        update(openWith(1), { type: 'enter-pressed', query: 'queen' }),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'open-suggestion', index: 1 },
      });
    });

    it('reports the trailing Search-for row as an index for the component to submit', () => {
      expect(
        update(openWith(ITEM_COUNT - 1), {
          type: 'enter-pressed',
          query: 'queen',
        }),
      ).toEqual({
        state: { open: false, highlighted: null },
        intent: { kind: 'open-suggestion', index: ITEM_COUNT - 1 },
      });
    });
  });
});
