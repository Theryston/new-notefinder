import { describe, expect, it, vi } from 'vitest';
import {
  activeRowIdFor,
  cancelEffects,
  comboboxKeyEvent,
  enabledEvent,
  isListOpen,
  keyEffects,
  pickSearchEffects,
  pickTrackEffects,
  rowsReported,
  runFieldEffects,
  suggestionRowId,
  suggestionRowLayout,
  suggestionRowProps,
} from './combobox-keys';
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

describe('keyEffects', () => {
  it('clicks the row an open-suggestion intent names', () => {
    expect(keyEffects({ kind: 'open-suggestion', index: 3 })).toEqual([
      { kind: 'click-row', index: 3 },
    ]);
  });

  it('blurs and collapses on a collapse-field intent', () => {
    expect(keyEffects({ kind: 'collapse-field' })).toEqual([
      { kind: 'blur' },
      { kind: 'collapse' },
    ]);
  });

  it('needs no DOM work for the other intents', () => {
    for (const intent of [
      { kind: 'none' },
      { kind: 'submit-search' },
      { kind: 'close-list' },
    ] as const) {
      expect(keyEffects(intent)).toEqual([]);
    }
  });
});

describe('field effect lists', () => {
  it('cancels by blurring and collapsing', () => {
    expect(cancelEffects).toEqual([{ kind: 'blur' }, { kind: 'collapse' }]);
  });

  it('clears the field on a Track pick, then blurs', () => {
    expect(pickTrackEffects).toEqual([
      { kind: 'set-value', value: '' },
      { kind: 'blur' },
    ]);
  });

  it('sets the normalized query on a Search-for pick, then blurs', () => {
    expect(pickSearchEffects('  under   pressure ')).toEqual([
      { kind: 'set-value', value: 'under pressure' },
      { kind: 'blur' },
    ]);
  });
});

describe('runFieldEffects', () => {
  it('runs each effect through its port, in order', () => {
    const calls: string[] = [];
    const ports = {
      clickRow: vi.fn((index: number) => calls.push(`click:${index}`)),
      blur: vi.fn(() => calls.push('blur')),
      collapse: vi.fn(() => calls.push('collapse')),
      setValue: vi.fn((value: string) => calls.push(`set:${value}`)),
    };

    runFieldEffects(
      [
        { kind: 'set-value', value: 'queen' },
        { kind: 'click-row', index: 2 },
        { kind: 'blur' },
        { kind: 'collapse' },
      ],
      ports,
    );

    expect(calls).toEqual(['set:queen', 'click:2', 'blur', 'collapse']);
  });

  it('does nothing without effects', () => {
    const ports = {
      clickRow: vi.fn(),
      blur: vi.fn(),
      collapse: vi.fn(),
      setValue: vi.fn(),
    };

    runFieldEffects([], ports);

    expect(ports.clickRow).not.toHaveBeenCalled();
    expect(ports.blur).not.toHaveBeenCalled();
    expect(ports.collapse).not.toHaveBeenCalled();
    expect(ports.setValue).not.toHaveBeenCalled();
  });
});

describe('isListOpen', () => {
  it('is open only where the list is shown', () => {
    expect(isListOpen({ open: true, highlighted: null }, true)).toBe(true);
  });

  it('stays closed on the search page, even from a stale open state', () => {
    expect(isListOpen({ open: true, highlighted: null }, false)).toBe(false);
  });

  it('is closed when the state is closed', () => {
    expect(isListOpen(closed, true)).toBe(false);
  });
});

describe('enabledEvent', () => {
  const event = { type: 'focused', query: 'queen' } as const;

  it('passes the event through where the list is enabled', () => {
    expect(enabledEvent(true, event)).toBe(event);
  });

  it('drops the event on the search page', () => {
    expect(enabledEvent(false, event)).toBeNull();
  });
});

describe('activeRowIdFor', () => {
  it('points the field at the highlighted row', () => {
    expect(activeRowIdFor(2)).toBe(suggestionRowId(2));
  });

  it('points at nothing when no row is highlighted', () => {
    expect(activeRowIdFor(null)).toBeUndefined();
  });
});

describe('suggestionRowProps', () => {
  it('gives each row a distinct id and option role', () => {
    expect(suggestionRowProps(0, null).id).not.toBe(
      suggestionRowProps(1, null).id,
    );
    expect(suggestionRowProps(0, null).role).toBe('option');
  });

  it('marks only the highlighted row as selected and highlighted', () => {
    expect(suggestionRowProps(1, 1)).toMatchObject({
      'aria-selected': true,
      'data-highlighted': true,
    });
    expect(suggestionRowProps(0, 1)).toMatchObject({
      'aria-selected': false,
      'data-highlighted': undefined,
    });
  });
});

describe('suggestionRowLayout', () => {
  it('puts the Search-for row after the Recordings, counting it as a row', () => {
    expect(suggestionRowLayout(6)).toEqual({
      searchForIndex: 6,
      rowCount: 7,
    });
  });

  it('still has the Search-for row with no Recordings', () => {
    expect(suggestionRowLayout(0)).toEqual({ searchForIndex: 0, rowCount: 1 });
  });
});

describe('rowsReported', () => {
  it('reports the row count and asks the reducer to reset the highlight', () => {
    expect(rowsReported(4)).toEqual({
      rowCount: 4,
      event: { type: 'suggestions-arrived' },
    });
  });
});
