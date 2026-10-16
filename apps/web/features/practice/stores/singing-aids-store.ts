import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

type Preferences = { countIn: boolean; guideMelody: boolean; offset: number };
const defaults: Preferences = { countIn: true, guideMelody: false, offset: 0 };
const KEY = 'notefinder.singing-aids.v1';
export const singingAidsStore = createStore<Preferences>(() => defaults);

/** localStorage belongs to this browser/device, never the account. */
export function loadSingingAids(): void {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return;
    singingAidsStore.setState({
      countIn:
        'countIn' in raw && typeof raw.countIn === 'boolean'
          ? raw.countIn
          : true,
      guideMelody: 'guideMelody' in raw && raw.guideMelody === true,
      offset:
        'offset' in raw &&
        typeof raw.offset === 'number' &&
        Number.isFinite(raw.offset) &&
        Math.abs(raw.offset) <= 1
          ? raw.offset
          : 0,
    });
  } catch {
    /* Storage may be blocked; the controls still work for this visit. */
  }
}

export function saveSingingAids(value: Partial<Preferences>): void {
  singingAidsStore.setState(value);
  try {
    localStorage.setItem(KEY, JSON.stringify(singingAidsStore.getState()));
  } catch {
    /* Keep the in-memory preference when storage is unavailable. */
  }
}

export function useSingingAids<T>(selector: (state: Preferences) => T): T {
  return useStore(singingAidsStore, selector);
}
