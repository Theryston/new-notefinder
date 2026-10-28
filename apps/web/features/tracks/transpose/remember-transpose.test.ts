import { afterEach, describe, expect, it } from 'vitest';

import { setTranspose, transposeStore } from '../stores/transpose-store';
import { rememberTranspose } from './remember-transpose';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

const semitones = () => transposeStore.getState().semitones;

describe('rememberTranspose', () => {
  afterEach(() => setTranspose(0));

  it('applies what was remembered for the Track', () => {
    const storage = memoryStorage();
    storage.setItem('vozzify:transpose:track-1', '3');

    const stop = rememberTranspose(storage, 'track-1');

    expect(semitones()).toBe(3);
    stop();
  });

  it('remembers every change after that, per Track', () => {
    const storage = memoryStorage();
    const stop = rememberTranspose(storage, 'track-1');

    setTranspose(-2);

    expect(storage.getItem('vozzify:transpose:track-1')).toBe('-2');
    stop();
  });

  it('puts the page back at the original key when it stops, without forgetting', () => {
    const storage = memoryStorage();
    const stop = rememberTranspose(storage, 'track-1');
    setTranspose(4);

    stop();

    expect(semitones()).toBe(0);
    expect(storage.getItem('vozzify:transpose:track-1')).toBe('4');
  });

  it('keeps the value inside the stepper limits', () => {
    setTranspose(40);

    expect(semitones()).toBe(12);
  });
});
