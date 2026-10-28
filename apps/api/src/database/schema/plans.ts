import {
  BENEFIT_STATUSES,
  BILLING_CYCLES,
  type BillingCycle,
  type LocalizedCatalogCopy,
  PLAN_CURRENCIES,
  type SaveAdminPlanBody,
} from '@notefinder/contracts';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

export const billingCycle = pgEnum('billing_cycle', BILLING_CYCLES);
export const planCurrency = pgEnum('plan_currency', PLAN_CURRENCIES);
export const benefitStatus = pgEnum('benefit_status', BENEFIT_STATUSES);
export const planKind = pgEnum('plan_kind', ['free', 'paid']);

export const plans = pgTable(
  'plans',
  {
    id: id(),
    kind: planKind().notNull(),
    copy: jsonb().$type<LocalizedCatalogCopy>().notNull(),
    displayOrder: integer().notNull().default(0),
    published: boolean().notNull().default(false),
    saleEnabled: boolean().notNull().default(false),
    stripeProductId: text(),
    pendingSyncId: text(),
    enabledCycles: billingCycle()
      .array()
      .$type<BillingCycle[]>()
      .notNull()
      .default([]),
    trialDays: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [index().on(table.published, table.displayOrder)],
);

export const benefits = pgTable('benefits', {
  id: id(),
  copy: jsonb().$type<LocalizedCatalogCopy>().notNull(),
  status: benefitStatus().notNull().default('coming-soon'),
  ...timestamps,
});

export const planBenefits = pgTable(
  'plan_benefits',
  {
    id: id(),
    planId: text()
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    benefitId: text()
      .notNull()
      .references(() => benefits.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    unique().on(table.planId, table.benefitId),
    unique().on(table.planId, table.position),
    index().on(table.benefitId),
  ],
);

/** Immutable amounts: a later price replaces the current row, retaining history. */
export const planPrices = pgTable(
  'plan_prices',
  {
    id: id(),
    planId: text()
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    cycle: billingCycle().notNull(),
    currency: planCurrency().notNull(),
    amount: integer().notNull(),
    stripePriceId: text(),
    current: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index().on(table.planId, table.current)],
);

export const planCatalogSettings = pgTable('plan_catalog_settings', {
  id: id(),
  contractingEnabled: boolean().notNull().default(false),
  ...timestamps,
});

export const planSyncOperations = pgTable(
  'plan_sync_operations',
  {
    id: id(),
    planId: text()
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    body: jsonb().$type<SaveAdminPlanBody>().notNull(),
    status: text().$type<'pending' | 'failed' | 'synced'>().notNull(),
    leaseUntil: timestamp({ withTimezone: true }),
    leaseToken: text(),
    ...timestamps,
  },
  (table) => [index().on(table.planId)],
);
