'use client';

// The DOM side of the header combobox: React state, focus and clicks. It is
// covered by the Playwright suite rather than by unit tests (a .tsx file in
// the config's measurement exclusions). The decisions live in the reducer and
// in `comboboxKeyEvent`, which the unit tests cover.

import type {
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import { useCallback, useRef, useState } from 'react';
import { comboboxKeyEvent, suggestionRowId } from '../combobox-keys';
import {
  type ComboboxEvent,
  type ComboboxIntent,
  type ComboboxState,
  initialComboboxState,
  updateCombobox,
} from '../combobox-state-machine';
import { normalizeSearchQuery } from '../search-params';

type SuggestionsComboboxInput = {
  inputValue: string;
  setInputValue: (value: SetStateAction<string>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** False on the search page, which has no list: only Enter and Escape act. */
  enabled: boolean;
  collapse: () => void;
};

/**
 * The combobox state, kept both in React state (to render) and in a ref
 * (read and written synchronously, so two events in one tick never read a
 * stale state). The ref also holds the row count the list reports: the
 * reducer wraps the arrow keys inside it.
 */
function useComboboxState() {
  const [state, setState] = useState<ComboboxState>(initialComboboxState);
  const stateRef = useRef<ComboboxState>(initialComboboxState);
  const rowCountRef = useRef(0);

  const send = useCallback((event: ComboboxEvent): ComboboxIntent => {
    const transition = updateCombobox(
      stateRef.current,
      event,
      rowCountRef.current,
    );
    stateRef.current = transition.state;
    setState(transition.state);
    return transition.intent;
  }, []);

  /** The list is lazy-loaded, so it reports its rows once they are rendered. */
  const onRowsChange = useCallback(
    (count: number) => {
      rowCountRef.current = count;
      send({ type: 'suggestions-arrived' });
    },
    [send],
  );

  return { state, stateRef, send, onRowsChange };
}

/**
 * Opens the row at `index` by clicking it, so Enter takes exactly the path a
 * mouse press takes (a Track link, the request and sign-in flows).
 */
function clickRow(index: number) {
  document.getElementById(suggestionRowId(index))?.click();
}

/**
 * The header suggestions combobox: whether the list is open, which row the
 * keyboard highlights, and the field events that move them. The reducer
 * decides; this hook keeps its state and runs the DOM side.
 */
export function useSuggestionsCombobox({
  inputValue,
  setInputValue,
  inputRef,
  enabled,
  collapse,
}: SuggestionsComboboxInput) {
  const { state, stateRef, send, onRowsChange } = useComboboxState();

  /** A pick or cancel blurs the field, as Enter does; the blur closes the list. */
  const leaveField = () => {
    send({ type: 'blurred' });
    inputRef.current?.blur();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const keyEvent = comboboxKeyEvent(event.key, inputValue, stateRef.current);
    if (!keyEvent) return;
    // Taken keys never move the caret or clear the field (Chrome clears a
    // search field on Escape), so the typed text survives every dismissal.
    event.preventDefault();
    const intent = send(keyEvent);
    if (intent.kind === 'open-suggestion') clickRow(intent.index);
    if (intent.kind === 'collapse-field') {
      leaveField();
      collapse();
    }
  };

  return {
    // The list never shows on the search page, even if a stale state is open.
    open: state.open && enabled,
    highlighted: state.highlighted,
    activeRowId:
      state.highlighted === null
        ? undefined
        : suggestionRowId(state.highlighted),
    send,
    onRowsChange,
    onKeyDown,
    onInputChange: (value: string) => {
      setInputValue(value);
      if (enabled) send({ type: 'input-changed', query: value });
    },
    onFocus: () => {
      if (enabled) send({ type: 'focused', query: inputValue });
    },
    onBlur: () => {
      send({ type: 'blurred' });
    },
    /** Cancel on a small screen: close the list and collapse, never navigate. */
    onCancel: () => {
      leaveField();
      collapse();
    },
    /** A Track row: the next page must not reopen the old query. */
    onPickTrack: () => {
      setInputValue('');
      leaveField();
    },
    /** The Search-for row: the field shows the query the search will use. */
    onPickSearch: () => {
      setInputValue(normalizeSearchQuery(inputValue));
      leaveField();
    },
  };
}

export type SuggestionsCombobox = ReturnType<typeof useSuggestionsCombobox>;
