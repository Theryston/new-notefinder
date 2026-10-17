import { isSearchableQuery } from './search-params';

/**
 * The header suggestions combobox: whether its list is open and which row is
 * highlighted (none, a Recording suggestion, or the trailing "Search for"
 * row). The component renders `itemCount` rows — the suggestions plus the
 * trailing row — so the last index is always the "Search for" row.
 *
 * A reducer with no React and no DOM, so the Node Vitest suite drives every
 * transition. The component keeps the state, passes its row count in, and
 * runs the returned intent: intents are side effects (navigate, collapse the
 * field) the state alone cannot express, while `none` means the state
 * already says everything (render it).
 */
export type ComboboxState = {
  open: boolean;
  highlighted: number | null;
};

/** The combobox starts closed with nothing highlighted. */
export const initialComboboxState: ComboboxState = {
  open: false,
  highlighted: null,
};

export type ComboboxIntent =
  | { kind: 'none' }
  /** Go to the search page with the current query. */
  | { kind: 'submit-search' }
  /**
   * Open the highlighted row. The trailing index is the "Search for" row,
   * which the component maps to a submit, exactly like clicking it.
   */
  | { kind: 'open-suggestion'; index: number }
  /** The list just closed; keep the field focused. */
  | { kind: 'close-list' }
  /**
   * The list was already closed, so there is nothing to dismiss: on small
   * screens collapse the expanded field, anywhere else ignore it.
   */
  | { kind: 'collapse-field' };

export type ComboboxEvent =
  | { type: 'input-changed'; query: string }
  | { type: 'focused'; query: string }
  | { type: 'blurred' }
  | { type: 'suggestions-arrived' }
  | { type: 'arrow-down' }
  | { type: 'arrow-up' }
  | { type: 'escape-pressed' }
  | { type: 'enter-pressed'; query: string };

export type ComboboxTransition = {
  state: ComboboxState;
  intent: ComboboxIntent;
};

function closeList(): ComboboxTransition {
  return {
    state: { open: false, highlighted: null },
    intent: { kind: 'none' },
  };
}

/**
 * Typing reopens the list while the query is searchable and clears any
 * highlight: the rows on screen are stale until the next fetch lands, so a
 * kept highlight could open the wrong suggestion on Enter. A blank query
 * always closes: the list never shows for an empty field.
 */
function handleInputChanged(query: string): ComboboxTransition {
  if (!isSearchableQuery(query)) {
    return closeList();
  }
  return {
    state: { open: true, highlighted: null },
    intent: { kind: 'none' },
  };
}

/**
 * Focusing a field that still has text reopens the list with the cached
 * suggestions (by click or with ⌘K / Ctrl K). The highlight is left alone:
 * blur always clears it first, so there is nothing stale to reset. A blank
 * field stays closed.
 */
function handleFocused(
  state: ComboboxState,
  query: string,
): ComboboxTransition {
  if (!isSearchableQuery(query)) {
    return closeList();
  }
  return {
    state: { open: true, highlighted: state.highlighted },
    intent: { kind: 'none' },
  };
}

/**
 * New rows reset the highlight, which would otherwise point at a different
 * row than before. The list never opens on its own: a response landing
 * after the field lost focus must not reopen it, so the component sends
 * this event whenever the rendered rows change and open stays as it is.
 */
function handleSuggestionsArrived(state: ComboboxState): ComboboxTransition {
  return {
    state: { open: state.open, highlighted: null },
    intent: { kind: 'none' },
  };
}

/**
 * Arrow navigation wraps around the list, trailing "Search for" row
 * included: Down from the last row lands on the first, Up from the first
 * lands on the last, Down from nothing starts at the first and Up from
 * nothing at the last. Wrapping (rather than clamping) keeps a short list
 * cyclable without looking; the boundaries are pinned by the tests. Arrows
 * never open a closed list and do nothing without rows.
 */
function handleArrowDown(
  state: ComboboxState,
  itemCount: number,
): ComboboxTransition {
  if (!state.open || itemCount <= 0) {
    return { state, intent: { kind: 'none' } };
  }
  const highlighted =
    state.highlighted === null ? 0 : (state.highlighted + 1) % itemCount;
  return { state: { open: true, highlighted }, intent: { kind: 'none' } };
}

function handleArrowUp(
  state: ComboboxState,
  itemCount: number,
): ComboboxTransition {
  if (!state.open || itemCount <= 0) {
    return { state, intent: { kind: 'none' } };
  }
  const highlighted =
    state.highlighted === null
      ? itemCount - 1
      : (state.highlighted - 1 + itemCount) % itemCount;
  return { state: { open: true, highlighted }, intent: { kind: 'none' } };
}

/**
 * The first Escape closes the list and keeps the field focused (focus never
 * leaves; the intent only tells the component a dismissal happened). A
 * second Escape finds the list already closed and collapses the expanded
 * field on small screens instead.
 */
function handleEscape(state: ComboboxState): ComboboxTransition {
  if (!state.open) {
    return { state, intent: { kind: 'collapse-field' } };
  }
  return {
    state: { open: false, highlighted: null },
    intent: { kind: 'close-list' },
  };
}

/**
 * Enter on a blank field does nothing. Otherwise the list closes and the
 * component either submits the search (nothing highlighted) or opens the
 * highlighted row.
 */
function handleEnter(state: ComboboxState, query: string): ComboboxTransition {
  if (!isSearchableQuery(query)) {
    return { state, intent: { kind: 'none' } };
  }
  const intent: ComboboxIntent =
    state.highlighted === null
      ? { kind: 'submit-search' }
      : { kind: 'open-suggestion', index: state.highlighted };
  return { state: { open: false, highlighted: null }, intent };
}

/**
 * One transition of the combobox. `itemCount` is the rows the component
 * renders (suggestions plus the trailing "Search for" row); only the arrow
 * events read it, to wrap the highlight inside the list.
 */
export function updateCombobox(
  state: ComboboxState,
  event: ComboboxEvent,
  itemCount: number,
): ComboboxTransition {
  switch (event.type) {
    case 'input-changed':
      return handleInputChanged(event.query);
    case 'focused':
      return handleFocused(state, event.query);
    case 'blurred':
      return closeList();
    case 'suggestions-arrived':
      return handleSuggestionsArrived(state);
    case 'arrow-down':
      return handleArrowDown(state, itemCount);
    case 'arrow-up':
      return handleArrowUp(state, itemCount);
    case 'escape-pressed':
      return handleEscape(state);
    case 'enter-pressed':
      return handleEnter(state, event.query);
  }
}
