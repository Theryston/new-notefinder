// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Subscription } from '@vozzify/contracts';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { billingKeys } from '../query-keys';
import { useChangeOptions } from './use-change-options';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/browser', () => ({ browserApi: api }));
vi.mock('next-intl', () => ({ useLocale: () => 'pt-BR' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const subscription: Subscription = {
  planId: 'pro',
  planName: 'Pro',
  cycle: 'monthly',
  currency: 'USD',
  amount: 350,
  status: 'confirmed',
  providerStatus: 'active',
  paidMembership: true,
  currentPeriodStart: '2026-01-01T00:00:00.000Z',
  currentPeriodEnd: '2027-01-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
};
const plan = {
  id: 'pro',
  kind: 'paid',
  name: 'Pro',
  saleAvailable: true,
  offers: [{ id: 'usd-annual', cycle: 'annual', amount: 3500 }],
};

beforeAll(async () => {
  // Schema compilation must finish before the query-readiness polling window.
  await import('@vozzify/contracts');
});

async function renderOptions() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  let state: ReturnType<typeof useChangeOptions> | undefined;
  function Harness() {
    state = useChangeOptions(subscription, 'user-1');
    return null;
  }
  const node = document.createElement('div');
  const root = createRoot(node);
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness)),
    ),
  );
  const current = () => {
    if (!state) throw new Error('Hook did not render');
    return state;
  };
  await vi.waitFor(() => expect(current().catalog.isSuccess).toBe(true));
  return {
    current,
    client,
    close: async () => {
      await act(async () => root.unmount());
      client.clear();
    },
  };
}

beforeEach(() => {
  api.mockReset();
  api.mockImplementation(
    async (
      _path: string,
      options: { query?: { locale?: string }; method?: string },
    ) => {
      if (options.method === 'POST') return { subscription };
      return {
        plans:
          options.query?.locale === 'en'
            ? [plan]
            : [{ ...plan, name: 'Localized plan' }],
      };
    },
  );
});

describe('Subscription change offers', () => {
  it('uses contracted currency while displaying names in the current language', async () => {
    const view = await renderOptions();
    try {
      expect(api.mock.calls.map(([, options]) => options.query.locale)).toEqual(
        ['en', 'pt-BR'],
      );
      expect(view.current().catalog.data).toEqual([
        { ...plan.offers[0], planId: 'pro', name: 'Localized plan' },
      ]);
    } finally {
      await view.close();
    }
  });
  it('submits the selected offer and refreshes the private subscription', async () => {
    const view = await renderOptions();
    try {
      const invalidate = vi.spyOn(view.client, 'invalidateQueries');
      await act(async () => {
        view.current().setSelection('usd-annual');
        view.current().setConfirming(true);
      });
      await act(async () => {
        await view.current().mutation.mutateAsync();
      });
      expect(api).toHaveBeenCalledWith(
        '/me/subscription/change',
        expect.objectContaining({
          method: 'POST',
          query: { locale: 'pt-BR' },
          body: { planId: 'pro', offerId: 'usd-annual', cycle: 'annual' },
        }),
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: billingKeys.subscription('user-1', 'pt-BR'),
      });
      expect(view.current().confirming).toBe(false);
    } finally {
      await view.close();
    }
  });
});
