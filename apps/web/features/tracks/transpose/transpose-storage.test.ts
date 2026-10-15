import { describe, expect, it, vi } from 'vitest';

import {
  readTranspose,
  transposeStorage,
  writeTranspose,
} from './transpose-storage';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  };
}

const throwing = () => {
  throw new Error('blocked');
};

describe('transpose storage', () => {
  it('remembers a transposition per Track', () => {
    const storage = memoryStorage();

    writeTranspose(storage, 'track-1', 3);
    writeTranspose(storage, 'track-2', -2);

    expect(readTranspose(storage, 'track-1')).toBe(3);
    expect(readTranspose(storage, 'track-2')).toBe(-2);
    expect(readTranspose(storage, 'track-3')).toBe(0);
  });

  it('forgets the Track when it is back at the original key', () => {
    const storage = memoryStorage();
    writeTranspose(storage, 'track-1', 3);

    writeTranspose(storage, 'track-1', 0);

    expect(storage.values.size).toBe(0);
  });

  it('reads a stored value that is out of range or garbage safely', () => {
    const storage = memoryStorage();
    storage.setItem('notefinder:transpose:a', '99');
    storage.setItem('notefinder:transpose:b', 'loud');

    expect(readTranspose(storage, 'a')).toBe(12);
    expect(readTranspose(storage, 'b')).toBe(0);
  });

  it('works without storage and when storage throws', () => {
    const blocked = {
      getItem: throwing,
      setItem: throwing,
      removeItem: throwing,
    };

    expect(readTranspose(undefined, 'track-1')).toBe(0);
    expect(readTranspose(blocked, 'track-1')).toBe(0);
    expect(() => writeTranspose(undefined, 'track-1', 2)).not.toThrow();
    expect(() => writeTranspose(blocked, 'track-1', 2)).not.toThrow();
    expect(() => writeTranspose(blocked, 'track-1', 0)).not.toThrow();
  });
});

describe('transposeStorage', () => {
  it('is undefined on the server', () => {
    expect(transposeStorage()).toBeUndefined();
  });

  it('is the browser storage when there is one', () => {
    const localStorage = memoryStorage();
    vi.stubGlobal('window', { localStorage });

    expect(transposeStorage()).toBe(localStorage);

    vi.unstubAllGlobals();
  });

  it('is undefined when the browser refuses access to it', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('blocked');
      },
    });

    expect(transposeStorage()).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
