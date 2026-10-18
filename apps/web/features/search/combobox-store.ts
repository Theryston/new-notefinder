import { rowsReported } from './combobox-keys';
import {
  type ComboboxEvent,
  type ComboboxIntent,
  type ComboboxState,
  initialComboboxState,
  updateCombobox,
} from './combobox-state-machine';

/**
 * The header combobox as a plain store (no React, no DOM): the reducer's
 * state, the row count the list reported, and the listeners to tell about
 * changes. The hook reads it with `useSyncExternalStore`, so the store is
 * the one place the state and the row count move together.
 */
export function createComboboxStore() {
  let state: ComboboxState = initialComboboxState;
  let rowCount = 0;
  const listeners = new Set<() => void>();

  /** Runs one event and returns the intent for the caller to act on. */
  const send = (event: ComboboxEvent): ComboboxIntent => {
    const transition = updateCombobox(state, event, rowCount);
    state = transition.state;
    for (const listener of listeners) listener();
    return transition.intent;
  };

  return {
    getState: (): ComboboxState => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    /** The list rendered `count` rows: the arrows wrap inside them. */
    reportRows: (count: number) => {
      const reported = rowsReported(count);
      rowCount = reported.rowCount;
      return send(reported.event);
    },
  };
}
