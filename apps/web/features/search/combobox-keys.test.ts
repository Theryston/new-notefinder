import { describe, expect, it } from 'vitest';
import { comboboxKeyEvent, suggestionRowId } from './combobox-keys';
import type { ComboboxState } from './combobox-state-machine';

const closed: ComboboxState = { open: false, highlighted: null };
const open: ComboboxState = { open: true, highlighted: null };
const highlightedOn = (index: number): ComboboxState => ({
  open: true,
  highlighted: index,
});

describe('comboboxKeyEvent', () => {
  it('moves the highlight with the arrows while the list is open', () => {
    expect(comboboxKeyEvent('ArrowDown', 'queen', open)).toEqual({
      type: 'arrow-down',
    });
    expect(comboboxKeyEvent('ArrowUp', 'queen', open)).toEqual({
      type: 'arrow-up',
    });
  });

  it('leaves the arrows to the caret while the list is closed', () => {
    expect(comboboxKeyEvent('ArrowDown', 'queen', closed)).toBeNull();
    expect(comboboxKeyEvent('ArrowUp', 'queen', closed)).toBeNull();
  });

  it('takes Escape whatever the list state, so the second press can collapse', () => {
    expect(comboboxKeyEvent('Escape', 'queen', open)).toEqual({
      type: 'escape-pressed',
    });
    expect(comboboxKeyEvent('Escape', '', closed)).toEqual({
      type: 'escape-pressed',
    });
  });

  it('takes Enter only with a highlighted row', () => {
    expect(comboboxKeyEvent('Enter', 'queen', highlightedOn(2))).toEqual({
      type: 'enter-pressed',
      query: 'queen',
    });
  });

  it('leaves Enter with nothing highlighted to the form submit', () => {
    expect(comboboxKeyEvent('Enter', 'queen', open)).toBeNull();
  });

  it('ignores every other key', () => {
    for (const key of ['a', 'Tab', 'Shift', 'Home']) {
      expect(comboboxKeyEvent(key, 'queen', highlightedOn(0))).toBeNull();
    }
  });
});

describe('suggestionRowId', () => {
  it('names each row by its index, so the field can point at it', () => {
    expect(suggestionRowId(0)).toBe('header-suggestion-0');
    expect(suggestionRowId(6)).not.toBe(suggestionRowId(5));
  });
});
