import type { ComboboxEvent, ComboboxState } from './combobox-state-machine';

/**
 * The DOM id of the header suggestion row at `index`, the trailing Search-for
 * row included. The field points `aria-activedescendant` at the highlighted
 * row with it, and Enter clicks that row.
 */
export function suggestionRowId(index: number): string {
  return `header-suggestion-${index}`;
}

/**
 * The combobox event a key press sends, or `null` when the combobox does not
 * take the key. Arrows only count while the list is open (otherwise they keep
 * moving the caret). Enter only counts with a highlighted row: with none, it
 * is the form's submit, as it always was. Escape always counts, so the first
 * press closes the list and the second collapses the field.
 */
export function comboboxKeyEvent(
  key: string,
  query: string,
  state: ComboboxState,
): ComboboxEvent | null {
  switch (key) {
    case 'ArrowDown':
      return state.open ? { type: 'arrow-down' } : null;
    case 'ArrowUp':
      return state.open ? { type: 'arrow-up' } : null;
    case 'Escape':
      return { type: 'escape-pressed' };
    case 'Enter':
      return state.highlighted === null
        ? null
        : { type: 'enter-pressed', query };
    default:
      return null;
  }
}
