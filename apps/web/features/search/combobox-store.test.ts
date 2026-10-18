import { describe, expect, it, vi } from 'vitest';

import { createComboboxStore } from './combobox-store';

describe('createComboboxStore', () => {
  it('starts closed with nothing highlighted', () => {
    expect(createComboboxStore().getState()).toEqual({
      open: false,
      highlighted: null,
    });
  });

  it('returns the intent of each event and keeps the new state', () => {
    const store = createComboboxStore();

    expect(store.send({ type: 'input-changed', query: 'queen' })).toEqual({
      kind: 'none',
    });
    expect(store.getState()).toEqual({ open: true, highlighted: null });
    expect(store.send({ type: 'enter-pressed', query: 'queen' })).toEqual({
      kind: 'submit-search',
    });
    expect(store.getState()).toEqual({ open: false, highlighted: null });
  });

  it('wraps the arrows inside the rows it was told about', () => {
    const store = createComboboxStore();
    store.send({ type: 'input-changed', query: 'queen' });
    store.reportRows(3);

    store.send({ type: 'arrow-up' });
    expect(store.getState().highlighted).toBe(2);
    store.send({ type: 'arrow-down' });
    expect(store.getState().highlighted).toBe(0);
  });

  it('resets the highlight when new rows are reported', () => {
    const store = createComboboxStore();
    store.send({ type: 'input-changed', query: 'queen' });
    store.reportRows(3);
    store.send({ type: 'arrow-down' });

    store.reportRows(4);

    expect(store.getState()).toEqual({ open: true, highlighted: null });
  });

  it('tells subscribers after each change, and stops once unsubscribed', () => {
    const store = createComboboxStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.send({ type: 'input-changed', query: 'queen' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.send({ type: 'blurred' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
