import { beforeEach, expect, it, vi } from 'vitest';
import {
  loadSingingAids,
  saveSingingAids,
  singingAidsStore,
} from './singing-aids-store';

let saved: string | null = null;
beforeEach(() => {
  saved = null;
  singingAidsStore.setState({ countIn: true, guideMelody: false, offset: 0 });
  vi.stubGlobal('localStorage', {
    getItem: () => saved,
    setItem: (_key: string, value: string) => {
      saved = value;
    },
  });
});
it('keeps count-in on and guide melody off until the visitor changes them', () => {
  loadSingingAids();
  expect(singingAidsStore.getState()).toEqual({
    countIn: true,
    guideMelody: false,
    offset: 0,
  });
  saveSingingAids({ countIn: false, guideMelody: true, offset: -0.12 });
  singingAidsStore.setState({ countIn: true, guideMelody: false, offset: 0 });
  loadSingingAids();
  expect(singingAidsStore.getState()).toEqual({
    countIn: false,
    guideMelody: true,
    offset: -0.12,
  });
});
it.each([
  'null',
  '[]',
  '{}',
  '{"offset":5,"countIn":"false","guideMelody":"true"}',
  '{bad',
])('ignores invalid stored preferences: %s', (value) => {
  saved = value;
  loadSingingAids();
  expect(singingAidsStore.getState()).toEqual({
    countIn: true,
    guideMelody: false,
    offset: 0,
  });
});
it('still applies controls with blocked storage', () => {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  });
  expect(() => loadSingingAids()).not.toThrow();
  saveSingingAids({ guideMelody: true });
  expect(singingAidsStore.getState().guideMelody).toBe(true);
});
