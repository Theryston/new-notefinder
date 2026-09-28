import { describe, expect, it, vi } from 'vitest';

import {
  browserStorage,
  cooldownSecondsLeft,
  readCodeSentAt,
  rememberCodeSentAt,
} from './resend-cooldown';

describe('cooldownSecondsLeft', () => {
  it('counts down from the full cooldown', () => {
    expect(cooldownSecondsLeft(1000, 1000)).toBe(60);
    expect(cooldownSecondsLeft(1000, 1001)).toBe(60);
    expect(cooldownSecondsLeft(1000, 59_500)).toBe(2);
  });

  it('reaches zero and never goes negative', () => {
    expect(cooldownSecondsLeft(0, 60_000)).toBe(0);
    expect(cooldownSecondsLeft(0, 120_000)).toBe(0);
  });

  it('accepts a custom cooldown', () => {
    expect(cooldownSecondsLeft(0, 0, 5)).toBe(5);
  });
});

describe('code sent-at storage', () => {
  const memoryStorage = () => {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    };
  };

  it('remembers the time per email, ignoring case and spaces', () => {
    const storage = memoryStorage();
    rememberCodeSentAt(storage, ' Ada@Example.com ', 1234);

    expect(readCodeSentAt(storage, 'ada@example.com')).toBe(1234);
    expect(readCodeSentAt(storage, 'other@example.com')).toBeNull();
  });

  it('keeps a separate time for each kind of code', () => {
    const storage = memoryStorage();
    rememberCodeSentAt(storage, 'ada@example.com', 1234);
    rememberCodeSentAt(storage, 'Ada@Example.com', 5678, 'forget-password');

    expect(readCodeSentAt(storage, 'ada@example.com')).toBe(1234);
    expect(
      readCodeSentAt(storage, 'ada@example.com', 'email-verification'),
    ).toBe(1234);
    expect(readCodeSentAt(storage, 'ada@example.com', 'forget-password')).toBe(
      5678,
    );
    expect(storage.getItem('notefinder:otp-sent-at:ada@example.com')).toBe(
      '1234',
    );
    expect(
      storage.getItem('notefinder:otp-sent-at:forget-password:ada@example.com'),
    ).toBe('5678');
  });

  it('ignores missing or invalid values', () => {
    const storage = memoryStorage();
    expect(readCodeSentAt(storage, 'ada@example.com')).toBeNull();
    storage.setItem('notefinder:otp-sent-at:ada@example.com', 'nope');
    expect(readCodeSentAt(storage, 'ada@example.com')).toBeNull();
    expect(readCodeSentAt(undefined, 'ada@example.com')).toBeNull();
  });

  it('survives a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readCodeSentAt(broken, 'ada@example.com')).toBeNull();
    expect(() =>
      rememberCodeSentAt(broken, 'ada@example.com', 1),
    ).not.toThrow();
  });

  it('has no storage outside the browser', () => {
    expect(browserStorage()).toBeUndefined();
  });

  it('uses localStorage in the browser', () => {
    const localStorage = memoryStorage();
    vi.stubGlobal('window', { localStorage });
    expect(browserStorage()).toBe(localStorage);
  });

  it('has no storage when the browser blocks it', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('SecurityError');
      },
    });
    expect(browserStorage()).toBeUndefined();
  });
});
