import {
  type CreateEditorialPinBody,
  type EditorialPin,
  editorialPinHistoryPageSchema,
  editorialPinPageSchema,
  editorialPinSchema,
  type UpdateEditorialPinBody,
} from '@vozzify/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import {
  createAdminPin,
  deleteAdminPin,
  fetchAdminPinHistory,
  fetchAdminPins,
  updateAdminPin,
} from './admin-pins-client';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const browserMock = vi.mocked(browserApi);

const pin = { id: 'pin_1' } as EditorialPin;

const body: CreateEditorialPinBody = {
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds: ['trk_a'] },
  position: 2,
  priority: 0,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Summer picks' },
  sponsored: false,
};

beforeEach(() => {
  browserMock.mockReset();
});

describe('fetchAdminPins', () => {
  it('reads the newest pins first', async () => {
    const page = { items: [pin], nextCursor: null };
    browserMock.mockResolvedValue(page);
    const signal = new AbortController().signal;

    await expect(fetchAdminPins(signal)).resolves.toBe(page);
    expect(browserMock).toHaveBeenCalledWith('/admin/home-pins', {
      schema: editorialPinPageSchema,
      query: { limit: 100 },
      signal,
    });
  });
});

describe('fetchAdminPinHistory', () => {
  it('reads who created and changed a pin', async () => {
    const page = { items: [], nextCursor: null };
    browserMock.mockResolvedValue(page);

    await expect(fetchAdminPinHistory('pin_1')).resolves.toBe(page);
    expect(browserMock).toHaveBeenCalledWith('/admin/home-pins/pin_1/history', {
      schema: editorialPinHistoryPageSchema,
      query: { limit: 100 },
      signal: undefined,
    });
  });

  it('escapes the pin id', async () => {
    browserMock.mockResolvedValue({ items: [], nextCursor: null });

    await fetchAdminPinHistory('pin 1/2');
    expect(browserMock).toHaveBeenCalledWith(
      '/admin/home-pins/pin%201%2F2/history',
      expect.anything(),
    );
  });
});

describe('createAdminPin', () => {
  it('pins a hero or a row', async () => {
    browserMock.mockResolvedValue(pin);

    await expect(createAdminPin(body)).resolves.toBe(pin);
    expect(browserMock).toHaveBeenCalledWith('/admin/home-pins', {
      method: 'POST',
      schema: editorialPinSchema,
      body,
    });
  });
});

describe('updateAdminPin', () => {
  it('changes a pin', async () => {
    const patch: UpdateEditorialPinBody = { sponsored: true };
    browserMock.mockResolvedValue(pin);

    await expect(updateAdminPin('pin_1', patch)).resolves.toBe(pin);
    expect(browserMock).toHaveBeenCalledWith('/admin/home-pins/pin_1', {
      method: 'PATCH',
      schema: editorialPinSchema,
      body: patch,
    });
  });
});

describe('deleteAdminPin', () => {
  it('removes a pin without a body', async () => {
    browserMock.mockResolvedValue(undefined);

    await expect(deleteAdminPin('pin_1')).resolves.toBeUndefined();
    const [, options] = browserMock.mock.calls[0] ?? [];
    expect(browserMock).toHaveBeenCalledWith(
      '/admin/home-pins/pin_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(options).not.toHaveProperty('body');
  });
});
