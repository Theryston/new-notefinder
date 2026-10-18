import type {
  ComboboxEvent,
  ComboboxIntent,
  ComboboxState,
} from './combobox-state-machine';
import { normalizeSearchQuery } from './search-params';

/** The listbox of the header suggestions; the field's `aria-controls` names it. */
export const SUGGESTIONS_LISTBOX_ID = 'header-suggestions-listbox';

/**
 * The DOM id of the header suggestion row at `index`, the trailing Search-for
 * row included. The field points `aria-activedescendant` at the highlighted
 * row with it, and Enter clicks that row.
 */
export function suggestionRowId(index: number): string {
  return `header-suggestion-${index}`;
}

/**
 * The props every suggestion row shares: its id, whether it is the highlighted
 * option (announced by the field's `aria-activedescendant`), and the
 * highlight's visual state.
 */
export function suggestionRowProps(index: number, highlighted: number | null) {
  const isHighlighted = highlighted === index;
  return {
    id: suggestionRowId(index),
    role: 'option' as const,
    'aria-selected': isHighlighted,
    'data-highlighted': isHighlighted || undefined,
  };
}

/**
 * The rows the list renders for `resultCount` Recordings: the Recordings
 * first, then the Search-for row. One place for both numbers, so the
 * highlight and the arrow wrap can never disagree with the rendered rows.
 */
export function suggestionRowLayout(resultCount: number) {
  return { searchForIndex: resultCount, rowCount: resultCount + 1 };
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

/**
 * The DOM work a header field event needs, described as data so the decisions
 * can be unit-tested without a DOM. The hook runs them through `runFieldEffects`.
 */
export type FieldEffect =
  | { kind: 'click-row'; index: number }
  | { kind: 'blur' }
  | { kind: 'collapse' }
  | { kind: 'set-value'; value: string };

/** The ports a field effect is run through: the hook supplies the DOM ones. */
export type FieldEffectPorts = {
  clickRow: (index: number) => void;
  blur: () => void;
  collapse: () => void;
  setValue: (value: string) => void;
};

/**
 * A row is opened by clicking it (so Enter takes the mouse path). A collapse
 * blurs and collapses the field. The other intents need no DOM work.
 */
export function keyEffects(intent: ComboboxIntent): FieldEffect[] {
  switch (intent.kind) {
    case 'open-suggestion':
      return [{ kind: 'click-row', index: intent.index }];
    case 'collapse-field':
      return cancelEffects;
    default:
      return [];
  }
}

/**
 * Leave the field and collapse it: a cancel, and a second Escape (which a
 * closed list turns into a collapse on every viewport, as the old header did).
 */
export const cancelEffects: FieldEffect[] = [
  { kind: 'blur' },
  { kind: 'collapse' },
];

/** A Track pick clears the field, so the next page does not reopen the query. */
export const pickTrackEffects: FieldEffect[] = [
  { kind: 'set-value', value: '' },
  { kind: 'blur' },
];

/** The Search-for pick leaves the field showing the query the search uses. */
export function pickSearchEffects(query: string): FieldEffect[] {
  return [
    { kind: 'set-value', value: normalizeSearchQuery(query) },
    { kind: 'blur' },
  ];
}

export function runFieldEffects(
  effects: FieldEffect[],
  ports: FieldEffectPorts,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'click-row':
        ports.clickRow(effect.index);
        break;
      case 'blur':
        ports.blur();
        break;
      case 'collapse':
        ports.collapse();
        break;
      case 'set-value':
        ports.setValue(effect.value);
        break;
    }
  }
}

/**
 * The list is open only where it can show: never on the search page, even if
 * a stale state is still open from another page.
 */
export function isListOpen(state: ComboboxState, enabled: boolean): boolean {
  return state.open && enabled;
}

/**
 * The field's events go to the combobox only where it has a list. On the
 * search page the field keeps mirroring `q`, so these are dropped.
 */
export function enabledEvent(
  enabled: boolean,
  event: ComboboxEvent,
): ComboboxEvent | null {
  return enabled ? event : null;
}

/** The `aria-activedescendant` of the field: the highlighted row, if any. */
export function activeRowIdFor(highlighted: number | null): string | undefined {
  return highlighted === null ? undefined : suggestionRowId(highlighted);
}

/**
 * The list reports how many rows it rendered: new rows reset the highlight
 * (the `suggestions-arrived` event), and the count bounds the arrow keys.
 */
export function rowsReported(rowCount: number) {
  return {
    rowCount,
    event: { type: 'suggestions-arrived' } as const satisfies ComboboxEvent,
  };
}
