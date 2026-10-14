import { describe, expect, it } from 'vitest';

import {
  nextViewAction,
  readStoredView,
  writeStoredView,
} from './track-view-session';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('stored view', () => {
  it('remembers a view per Track', () => {
    const storage = memoryStorage();

    writeStoredView(storage, 'track-1', { viewId: 'v1', attached: false });
    writeStoredView(storage, 'track-2', { viewId: 'v2', attached: true });

    expect(readStoredView(storage, 'track-1')).toEqual({
      viewId: 'v1',
      attached: false,
    });
    expect(readStoredView(storage, 'track-2')).toEqual({
      viewId: 'v2',
      attached: true,
    });
    expect(readStoredView(storage, 'track-3')).toBeUndefined();
  });

  it.each([
    ['not JSON', 'nope'],
    ['not an object', '"v1"'],
    ['without a view ID', '{"attached":true}'],
    ['with an empty view ID', '{"viewId":"","attached":true}'],
    ['without the attached flag', '{"viewId":"v1"}'],
  ])('ignores a stored value that is %s', (_name, raw) => {
    const storage = memoryStorage();
    storage.setItem('notefinder:track-view:track-1', raw);

    expect(readStoredView(storage, 'track-1')).toBeUndefined();
  });

  it('works without storage, or with one that throws', () => {
    expect(readStoredView(undefined, 'track-1')).toBeUndefined();
    expect(readStoredView(throwingStorage, 'track-1')).toBeUndefined();
    expect(() =>
      writeStoredView(throwingStorage, 'track-1', {
        viewId: 'v1',
        attached: false,
      }),
    ).not.toThrow();
    expect(() =>
      writeStoredView(undefined, 'track-1', { viewId: 'v1', attached: false }),
    ).not.toThrow();
  });
});

describe('nextViewAction', () => {
  it('records the first visit of the session, signed in or not', () => {
    expect(nextViewAction(undefined, false)).toBe('record');
    expect(nextViewAction(undefined, true)).toBe('record');
  });

  it('attaches a User who signed in after the view was recorded', () => {
    expect(nextViewAction({ viewId: 'v1', attached: false }, true)).toBe(
      'attach',
    );
  });

  it('does nothing more once the session has its view', () => {
    expect(nextViewAction({ viewId: 'v1', attached: false }, false)).toBe(
      'none',
    );
    expect(nextViewAction({ viewId: 'v1', attached: true }, true)).toBe('none');
  });
});
