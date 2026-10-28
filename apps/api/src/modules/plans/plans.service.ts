import { Injectable } from '@nestjs/common';
import {
  BILLING_CYCLES,
  type Locale,
  localizedCatalogCopySchema,
  PLAN_CURRENCIES,
  type Plan,
  type PlanCatalog,
  type PlanCurrency,
} from '@notefinder/contracts';
import { ZodSerializationException } from '../../common/zod/zod-serializer.interceptor.js';
import { PlansRepository } from './plans.repository.js';

type CatalogRecord = Awaited<
  ReturnType<PlansRepository['findPublished']>
>[number];

function localizedCopy(copy: unknown, locale: Locale) {
  const parsed = localizedCatalogCopySchema.safeParse(copy);
  if (!parsed.success) throw new ZodSerializationException(parsed.error);
  return parsed.data[locale];
}

function publicPlan(
  row: CatalogRecord,
  locale: Locale,
  currency: PlanCurrency,
): Plan {
  // An incomplete paid cycle is never offered in either currency. The free
  // comparison has no billable offers, even if malformed rows name prices.
  const cycles =
    row.kind === 'free'
      ? []
      : BILLING_CYCLES.filter(
          (cycle) =>
            row.enabledCycles.includes(cycle) &&
            PLAN_CURRENCIES.every((required) =>
              row.prices.some(
                (price) =>
                  price.cycle === cycle &&
                  price.currency === required &&
                  price.amount > 0,
              ),
            ),
        );
  return {
    id: row.id,
    kind: row.kind,
    ...localizedCopy(row.copy, locale),
    trialDays: row.trialDays,
    offers: cycles.flatMap((cycle) =>
      row.prices
        .filter((price) => price.cycle === cycle && price.currency === currency)
        .map((price) => ({ id: price.id, cycle, amount: price.amount })),
    ),
    benefits: row.benefits.flatMap((benefit) =>
      benefit.status === 'hidden'
        ? []
        : [
            {
              id: benefit.id,
              ...localizedCopy(benefit.copy, locale),
              status: benefit.status,
            },
          ],
    ),
  };
}

@Injectable()
export class PlansService {
  constructor(private readonly plans: PlansRepository) {}

  async getCatalog(locale: Locale): Promise<PlanCatalog> {
    const rows = await this.plans.findPublished();
    const currency = locale === 'pt-BR' ? 'BRL' : 'USD';
    return {
      currency,
      plans: rows.map((row) => publicPlan(row, locale, currency)),
    };
  }
}
