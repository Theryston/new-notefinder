import type { QueryFunctionContext } from '@tanstack/react-query';
import type { EditorialPinHistoryPage } from '@vozzify/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAdminPinHistory, fetchAdminPins } from './admin-pins-client';
import {
  adminPinHistoryQueryOptions,
  adminPinKeys,
  adminPinsQueryOptions,
} from './admin-pins-query';

vi.mock('./admin-pins-client', () => ({
  fetchAdminPins: vi.fn(),
  fetchAdminPinHistory: vi.fn(),
}));

const pinsMock = vi.mocked(fetchAdminPins);
const historyMock = vi.mocked(fetchAdminPinHistory);

const contextOf = <TKey extends readonly unknown[]>(signal: AbortSignal) =>
  ({ signal }) as QueryFunctionContext<TKey>;

beforeEach(() => {
  pinsMock.mockReset();
  historyMock.mockReset();
});

describe('adminPinKeys', () => {
  it('reads from one shared root', () => {
    expect(adminPinKeys.list()).toEqual(['admin-home-pins', 'list']);
    expect(adminPinKeys.history('pin_1')).toEqual([
      'admin-home-pins',
      'pin_1',
      'history',
    ]);
  });
});

describe('adminPinsQueryOptions', () => {
  it('keys the list', () => {
    expect(adminPinsQueryOptions().queryKey).toEqual(adminPinKeys.list());
  });

  it('fetches every pin once', async () => {
    const page = { items: [], nextCursor: null };
    pinsMock.mockResolvedValue(page);
    const signal = new AbortController().signal;

    const options = adminPinsQueryOptions();
    await expect(
      options.queryFn?.(contextOf<typeof options.queryKey>(signal)),
    ).resolves.toBe(page);
    expect(pinsMock).toHaveBeenCalledWith(signal);
  });
});

describe('adminPinHistoryQueryOptions', () => {
  it('keys one pin history', () => {
    expect(adminPinHistoryQueryOptions('pin_1').queryKey).toEqual(
      adminPinKeys.history('pin_1'),
    );
  });

  it('fetches the history', async () => {
    const page = { items: [], nextCursor: null };
    historyMock.mockResolvedValue(page as EditorialPinHistoryPage);
    const signal = new AbortController().signal;

    const options = adminPinHistoryQueryOptions('pin_1');
    await expect(
      options.queryFn?.(contextOf<typeof options.queryKey>(signal)),
    ).resolves.toBe(page);
    expect(historyMock).toHaveBeenCalledWith('pin_1', signal);
  });
});
