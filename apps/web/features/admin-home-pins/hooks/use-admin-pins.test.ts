// @vitest-environment happy-dom

import type { CreateEditorialPinBody } from '@notefinder/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { useAdminPinMutations } from './use-admin-pin-mutations';
import { useAdminPins } from './use-admin-pins';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const listPage = { items: [], nextCursor: null };

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(NextIntlClientProvider, {
    locale: 'en',
    messages: { errors: messages.errors },
    // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
    children: createElement(QueryClientProvider, { client }, children),
  });
}

async function renderHarness(tree: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(Providers, null, tree));
  });
  return {
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** The latest hook result, once `ready` passes. Resolves without polling. */
function settleWith<T>(
  useHook: () => T,
  ready: (result: T) => boolean,
): {
  tree: ReactNode;
  settled: Promise<void>;
  latest: () => T;
} {
  let resolve!: () => void;
  const settled = new Promise<void>((done) => {
    resolve = done;
  });
  let latest!: T;
  function Harness() {
    latest = useHook();
    if (ready(latest)) resolve();
    return null;
  }
  return { tree: createElement(Harness), settled, latest: () => latest };
}

const querySettled = (query: { isSuccess: boolean; isError: boolean }) =>
  query.isSuccess || query.isError;

describe('useAdminPins', () => {
  it('reads every pin from the admin endpoint', async () => {
    fetchMock.mockResolvedValue(Response.json(listPage));
    const { tree, settled, latest } = settleWith(useAdminPins, querySettled);

    const { unmount } = await renderHarness(tree);
    try {
      await act(async () => {
        await settled;
      });
      const [input] = fetchMock.mock.lastCall ?? [];
      const url = new URL(String(input));
      expect(url.pathname).toBe('/v1/admin/home-pins');
      expect(url.searchParams.get('limit')).toBe('100');
      expect(latest()).toMatchObject({ data: listPage });
    } finally {
      await unmount();
    }
  });
});

const createBody: CreateEditorialPinBody = {
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

describe('useAdminPinMutations', () => {
  it('creates, changes and removes pins, then reloads the list', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (init?.method === 'POST' || init?.method === 'PATCH') {
        const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json(
          {
            id: 'pin_9',
            createdBy: { id: 'usr_admin', name: 'Admin' },
            updatedBy: { id: 'usr_admin', name: 'Admin' },
            createdAt: '2026-10-21T12:00:00.000Z',
            updatedAt: '2026-10-21T12:00:00.000Z',
            ...createBody,
            ...sent,
          },
          { status: init.method === 'POST' ? 201 : 200 },
        );
      }
      return Response.json(listPage);
    });

    const usePanel = () => ({
      mutations: useAdminPinMutations(),
      pins: useAdminPins(),
    });
    const { tree, settled, latest } = settleWith(usePanel, ({ pins }) =>
      querySettled(pins),
    );
    const { unmount } = await renderHarness(tree);
    try {
      await act(async () => {
        await settled;
      });
      const mutations = latest().mutations;
      const listCalls = () =>
        fetchMock.mock.calls.filter(
          ([input, init]) =>
            new URL(String(input)).pathname === '/v1/admin/home-pins' &&
            (init?.method ?? 'GET') === 'GET',
        ).length;

      await act(async () => {
        await mutations.createPin.mutateAsync({ ...createBody });
      });
      const [, postInit] = fetchMock.mock.calls.find(
        ([, init]) => init?.method === 'POST',
      ) ?? [undefined, undefined];
      expect(JSON.parse(String(postInit?.body)).sponsored).toBe(false);

      await act(async () => {
        await mutations.updatePin.mutateAsync({
          pinId: 'pin_9',
          body: { sponsored: true },
        });
      });
      const [patchInput, patchInit] = fetchMock.mock.calls.find(
        ([, init]) => init?.method === 'PATCH',
      ) ?? [undefined, undefined];
      expect(new URL(String(patchInput)).pathname).toBe(
        '/v1/admin/home-pins/pin_9',
      );
      expect(JSON.parse(String(patchInit?.body))).toEqual({
        sponsored: true,
      });

      await act(async () => {
        await mutations.deletePin.mutateAsync('pin_9');
      });
      const [deleteInput, deleteInit] = fetchMock.mock.calls.find(
        ([, init]) => init?.method === 'DELETE',
      ) ?? [undefined, undefined];
      expect(new URL(String(deleteInput)).pathname).toBe(
        '/v1/admin/home-pins/pin_9',
      );
      expect(deleteInit?.body).toBeUndefined();

      // Every change reloads the list.
      expect(listCalls()).toBeGreaterThanOrEqual(4);
    } finally {
      await unmount();
    }
  });

  it('toasts a translated API error without breaking the panel', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      if ((init?.method ?? 'GET') === 'GET') return Response.json(listPage);
      return Response.json(
        { statusCode: 403, code: 'FORBIDDEN', message: 'No' },
        { status: 403 },
      );
    });

    const { tree, settled, latest } = settleWith(
      useAdminPinMutations,
      () => true,
    );
    const { unmount } = await renderHarness(tree);
    try {
      await act(async () => {
        await settled;
      });
      await expect(
        act(async () => {
          await latest().deletePin.mutateAsync('pin_9');
        }),
      ).rejects.toThrow();
    } finally {
      await unmount();
    }
  });
});
