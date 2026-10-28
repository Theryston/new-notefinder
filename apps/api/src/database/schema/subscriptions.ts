import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { billingCycle, planCurrency, planPrices, plans } from './plans.js';
import { users } from './users.js';

export const billingCustomers = pgTable('billing_customers', {
  id: id(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  stripeCustomerId: text().unique(),
  ...timestamps,
});

// One retained contract slot per User also reserves pending and recovery states.
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    planId: text()
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    priceId: text()
      .notNull()
      .references(() => planPrices.id, { onDelete: 'restrict' }),
    cycle: billingCycle().notNull(),
    currency: planCurrency().notNull(),
    amount: integer().notNull(),
    stripePriceId: text().notNull(),
    stripeSubscriptionId: text().unique(),
    checkoutId: text().unique(),
    checkoutUrl: text(),
    providerStatus: text(),
    status: text()
      .$type<'pending' | 'confirmed' | 'unsuccessful'>()
      .notNull()
      .default('pending'),
    paidMembership: boolean().notNull().default(false),
    currentPeriodStart: timestamp({ withTimezone: true }),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    ...timestamps,
  },
  (table) => [index().on(table.planId), index().on(table.priceId)],
);

export const billingEvents = pgTable(
  'billing_events',
  {
    id: id(),
    providerEventId: text().notNull(),
    ...timestamps,
  },
  (table) => [unique().on(table.providerEventId)],
);
