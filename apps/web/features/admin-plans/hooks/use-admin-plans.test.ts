// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planFormDefaults } from '../form';
import { adminPlanKeys } from '../query-keys';
import {
  useContractingMutation,
  useSaveAdminPlan,
} from './use-admin-plan-mutations';
import { useAdminPlans } from './use-admin-plans';

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const network = vi.fn<typeof fetch>();
beforeEach(() => {
  network.mockReset();
  vi.stubGlobal('fetch', network);
});

type Panel = {
  catalog: ReturnType<typeof useAdminPlans>;
  save: ReturnType<typeof useSaveAdminPlan>;
  contracting: ReturnType<typeof useContractingMutation>;
};
async function renderPanel(onSuccess: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  let state: Panel | undefined;
  function Harness() {
    state = {
      catalog: useAdminPlans(),
      save: useSaveAdminPlan({ planId: 'studio', onSuccess }),
      contracting: useContractingMutation(),
    };
    return null;
  }
  const ready = new Promise<void>((resolve) => {
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.query.state.status !== 'pending') {
        unsubscribe();
        resolve();
      }
    });
  });
  const node = document.createElement('div');
  document.body.append(node);
  const root = createRoot(node);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness)),
    );
  });
  await act(async () => {
    await ready;
  });
  return {
    client,
    current: () => {
      if (!state) throw new Error('The panel did not render');
      return state;
    },
    close: async () => {
      await act(async () => {
        root.unmount();
      });
      node.remove();
      client.clear();
    },
  };
}

describe('Private admin plan server state', () => {
  it('refreshes the list after saving and updates the same cache for sales controls', async () => {
    const catalog = { contractingEnabled: false, plans: [] };
    const input = planFormDefaults();
    input.copy = {
      en: { name: 'Studio', description: 'Practice tools.' },
      'pt-BR': { name: 'Studio BR', description: 'Localized tools.' },
    };
    network.mockImplementation(async (_url, init) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        if ('contractingEnabled' in body)
          return Response.json({ ...catalog, contractingEnabled: true });
        return Response.json({
          ...input,
          id: 'studio',
          kind: 'paid',
          syncStatus: 'synced',
          pendingOperation: null,
        });
      }
      return Response.json(catalog);
    });
    const success = vi.fn();
    const panel = await renderPanel(success);
    try {
      expect(panel.client.getQueryData(adminPlanKeys.catalog)).toEqual(catalog);
      await act(async () => {
        await panel.current().save.mutateAsync(input);
      });
      expect(success).toHaveBeenCalledTimes(1);
      expect(
        network.mock.calls.filter(
          ([, init]) => !init?.method || init.method === 'GET',
        ).length,
      ).toBe(2);
      await act(async () => {
        await panel.current().contracting.mutateAsync(true);
      });
      expect(panel.client.getQueryData(adminPlanKeys.catalog)).toMatchObject({
        contractingEnabled: true,
      });
    } finally {
      await panel.close();
    }
  });
  it('preserves a failed draft and refreshes recoverable server state', async () => {
    network.mockImplementation(async (_url, init) =>
      init?.method === 'PUT'
        ? Response.json(
            {
              statusCode: 503,
              code: 'SERVICE_UNAVAILABLE',
              message: 'Provider unavailable',
            },
            { status: 503 },
          )
        : Response.json({ contractingEnabled: false, plans: [] }),
    );
    const success = vi.fn();
    const panel = await renderPanel(success);
    try {
      await expect(
        act(async () => {
          await panel.current().save.mutateAsync(planFormDefaults());
        }),
      ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(success).not.toHaveBeenCalled();
      expect(
        network.mock.calls.filter(
          ([, init]) => !init?.method || init.method === 'GET',
        ).length,
      ).toBe(2);
    } finally {
      await panel.close();
    }
  });
});
