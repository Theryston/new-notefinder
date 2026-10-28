import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

import type { Locale, PlanCatalog } from '@vozzify/contracts';

import { json, readBody } from './fake-api-http.ts';

type Copy = {
  freeName: string;
  freeDescription: string;
  proDescription: string;
  benefits: PlanCatalog['plans'][number]['benefits'];
};

export function defaultPlanCatalog(locale: Locale): PlanCatalog {
  const copy: Copy = JSON.parse(
    readFileSync(
      new URL(`./plans-${locale.toLowerCase()}.json`, import.meta.url),
      'utf8',
    ),
  );
  return {
    currency: locale === 'en' ? 'USD' : 'BRL',
    plans: [
      {
        id: 'free',
        kind: 'free',
        name: copy.freeName,
        description: copy.freeDescription,
        trialDays: 0,
        offers: [],
        benefits: copy.benefits.filter(
          (benefit) => benefit.status === 'available',
        ),
      },
      {
        id: 'pro',
        kind: 'paid',
        name: 'Pro',
        description: copy.proDescription,
        trialDays: 0,
        offers: [
          {
            id: 'monthly',
            cycle: 'monthly',
            amount: locale === 'en' ? 350 : 1990,
          },
          {
            id: 'annual',
            cycle: 'annual',
            amount: locale === 'en' ? 3500 : 19900,
          },
        ],
        benefits: copy.benefits.filter(
          (benefit) => benefit.status === 'coming-soon',
        ),
      },
    ],
  };
}

type Reply = { catalog?: PlanCatalog; status?: number; delayMs?: number };
const overrides = new Map<Locale, Reply>();

export const planRoutes = [
  {
    method: 'GET',
    pathname: '/v1/plans',
    serve: async (
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<void> => {
      const locale =
        new URL(request.url ?? '/', 'http://localhost').searchParams.get(
          'locale',
        ) === 'pt-BR'
          ? 'pt-BR'
          : 'en';
      const reply = overrides.get(locale);
      const status = reply?.status ?? 200;
      if (reply?.delayMs) await delay(reply.delayMs);
      json(
        response,
        status,
        status === 200
          ? (reply?.catalog ?? defaultPlanCatalog(locale))
          : {
              statusCode: status,
              code: 'INTERNAL_ERROR',
              message: 'Catalog unavailable',
            },
        request,
      );
    },
  },
  {
    method: 'POST',
    pathname: '/__plans-mock/set',
    serve: async (
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<void> => {
      const data = (await readBody(request)) as Reply & { locale: Locale };
      overrides.set(data.locale, data);
      json(response, 200, { ok: true }, request);
    },
  },
];
