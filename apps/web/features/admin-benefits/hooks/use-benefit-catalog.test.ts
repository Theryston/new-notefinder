// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminBenefits, WriteBenefitBody } from '@vozzify/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en.json';
import { fetchBenefit } from '../benefits-client';
import { useBenefitCatalog } from './use-benefit-catalog';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const fetchMock = vi.fn<typeof fetch>();
const body: WriteBenefitBody = {
  copy: {
    en: { name: 'Cloud', description: 'Cloud recordings' },
    'pt-BR': { name: 'Cloud PT', description: 'Localized description' },
  },
  status: 'coming-soon',
};
const plan = { id: 'pro', copy: body.copy, benefitIds: [] };

function catalogReply(path: string, benefits: AdminBenefits) {
  if (path === '/v1/admin/plan-benefits') return [plan];
  if (path.endsWith('/cloud')) return benefits[0];
  return benefits;
}

async function mountCatalog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let latest: ReturnType<typeof useBenefitCatalog> | undefined;
  let done: (() => void) | undefined;
  const settled = new Promise<void>((resolve) => {
    done = resolve;
  });
  function Harness() {
    latest = useBenefitCatalog();
    if (!latest.benefits.isPending && !latest.plans.isPending) done?.();
    return null;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const provider = createElement(NextIntlClientProvider, {
    locale: 'en',
    messages: { errors: messages.errors },
    // biome-ignore lint/correctness/noChildrenProp: this test uses createElement rather than JSX
    children: createElement(
      QueryClientProvider,
      { client },
      createElement(Harness),
    ),
  });
  await act(async () => {
    root.render(provider);
  });
  await act(async () => {
    await settled;
  });
  return {
    read: () => {
      if (!latest) throw new Error('Hook has not rendered');
      return latest;
    },
    close: async () => {
      await act(async () => root.unmount());
      client.clear();
      container.remove();
    },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('Admin benefit catalog client', () => {
  it('refreshes catalog and associations after creation, editing, linking and deletion', async () => {
    let benefits: AdminBenefits = [];
    fetchMock.mockImplementation(async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      if (init.method === 'DELETE') {
        benefits = [];
        return new Response(null, { status: 204 });
      }
      if (init.method === 'POST' || init.method === 'PATCH') {
        benefits = [
          { ...body, ...JSON.parse(String(init.body)), id: 'cloud', plans: [] },
        ];
        return Response.json(benefits[0]);
      }
      if (init.method === 'PUT')
        return Response.json({ ...plan, benefitIds: ['cloud'] });
      return Response.json(catalogReply(path, benefits));
    });
    const harness = await mountCatalog();
    try {
      expect(harness.read().benefits.data).toEqual([]);
      await act(async () => {
        await harness.read().save.mutateAsync({ body });
      });
      await vi.waitFor(() =>
        expect(harness.read().benefits.data?.[0]?.copy.en.name).toBe('Cloud'),
      );
      await act(async () => {
        await harness.read().save.mutateAsync({
          id: 'cloud',
          body: { ...body, status: 'available' },
        });
      });
      await vi.waitFor(() =>
        expect(harness.read().benefits.data?.[0]?.status).toBe('available'),
      );
      expect(await fetchBenefit('cloud')).toMatchObject({
        id: 'cloud',
        status: 'available',
      });
      await act(async () => {
        await harness
          .read()
          .link.mutateAsync({ planId: 'pro', benefitIds: ['cloud'] });
      });
      await act(async () => {
        await harness.read().remove.mutateAsync('cloud');
      });
      await vi.waitFor(() => expect(harness.read().benefits.data).toEqual([]));
      const reads = fetchMock.mock.calls.filter(
        ([, init]) => init?.method === 'GET',
      );
      expect(reads.length).toBeGreaterThanOrEqual(10);
      expect(
        fetchMock.mock.calls.every(
          ([, init]) => init?.credentials === 'include',
        ),
      ).toBe(true);
    } finally {
      await harness.close();
    }
  });

  it('preserves cached data and translates permission errors when a write fails', async () => {
    fetchMock.mockImplementation(async (input, init = {}) => {
      if (init.method !== 'GET')
        return Response.json(
          { statusCode: 403, code: 'FORBIDDEN', message: 'Admin required' },
          { status: 403 },
        );
      return Response.json(
        new URL(String(input)).pathname.endsWith('plan-benefits')
          ? [plan]
          : [{ ...body, id: 'cloud', plans: [] }],
      );
    });
    const harness = await mountCatalog();
    try {
      await expect(
        act(async () => {
          await harness.read().remove.mutateAsync('cloud');
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(harness.read().benefits.data).toHaveLength(1);
      expect(toast.error).toHaveBeenCalledWith(messages.errors.FORBIDDEN);
    } finally {
      await harness.close();
    }
  });

  it('translates unexpected write failures instead of exposing their message', async () => {
    fetchMock.mockResolvedValue(Response.json([]));
    const harness = await mountCatalog();
    try {
      vi.spyOn(
        await import('../benefits-client'),
        'deleteBenefit',
      ).mockRejectedValue(new Error('Internal detail'));
      await expect(
        act(async () => {
          await harness.read().remove.mutateAsync('cloud');
        }),
      ).rejects.toThrow();
      expect(toast.error).toHaveBeenCalledWith(messages.errors.INTERNAL_ERROR);
    } finally {
      await harness.close();
    }
  });
});
