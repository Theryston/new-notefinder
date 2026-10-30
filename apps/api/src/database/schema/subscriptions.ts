import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
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
  trialUsedAt: timestamp({ withTimezone: true }),
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
    hasPaidInvoice: boolean().notNull().default(false),
    recoveryInvoiceId: text(),
    recoveryStartedAt: timestamp({ withTimezone: true }),
    trialDays: integer().notNull().default(0),
    currentPeriodStart: timestamp({ withTimezone: true }),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    ...timestamps,
  },
  (table) => [index().on(table.planId), index().on(table.priceId)],
);

export const subscriptionHistory = pgTable('subscription_history', {
  id: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contract: jsonb().notNull(),
  ...timestamps,
});

export const billingEvents = pgTable(
  'billing_events',
  {
    id: id(),
    providerEventId: text().notNull(),
    ...timestamps,
  },
  (table) => [unique().on(table.providerEventId)],
);

// The snapshot is retained even if the destination price is later retired.
export const subscriptionChanges = pgTable('subscription_changes', {
  id: id(),
  subscriptionId: text()
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
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
  effectiveAt: timestamp({ withTimezone: true }).notNull(),
  stripeScheduleId: text(),
  applied: boolean().notNull().default(false),
  agreed: jsonb().$type<{
    planId: string;
    priceId: string;
    cycle: 'monthly' | 'annual';
    currency: 'BRL' | 'USD';
    amount: number;
    stripePriceId: string;
    effectiveAt: string;
  }>(),
  ...timestamps,
});

// Each row represents one price notice and its eventual provider transition.
export const subscriptionPriceChanges = pgTable(
  'subscription_price_changes',
  {
    id: id(),
    sequence: bigserial({ mode: 'number' }).notNull().unique(),
    // Contracts move to subscription_history when a User returns, so this ID
    // outlives the active subscription row.
    subscriptionId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    oldPriceId: text()
      .notNull()
      .references(() => planPrices.id, { onDelete: 'restrict' }),
    newPriceId: text()
      .notNull()
      .references(() => planPrices.id, { onDelete: 'restrict' }),
    oldAmount: integer().notNull(),
    newAmount: integer().notNull(),
    noticeStatus: text()
      .$type<
        'pending' | 'sending' | 'sent' | 'failed' | 'uncertain' | 'rejected'
      >()
      .notNull()
      .default('pending'),
    noticeStartedAt: timestamp({ withTimezone: true }),
    noticeSentAt: timestamp({ withTimezone: true }),
    effectiveAt: timestamp({ withTimezone: true }),
    noticeAttempt: integer().notNull().default(0),
    noticeHistory: jsonb()
      .$type<{ sentAt: string; effectiveAt: string }[]>()
      .notNull()
      .default([]),
    noticeMessage: jsonb().$type<{
      to: string;
      subject: string;
      html: string;
      text: string;
      sendBefore?: string;
      tags?: { name: string; value: string }[];
    }>(),
    reconcileCursor: text(),
    nextReconcileAt: timestamp({ withTimezone: true }),
    scheduleStatus: text()
      .$type<'pending' | 'scheduled' | 'failed' | 'completed' | 'cancelled'>()
      .notNull()
      .default('pending'),
    ...timestamps,
  },
  (table) => [
    unique().on(table.subscriptionId, table.newPriceId),
    index().on(table.noticeStatus, table.scheduleStatus),
    index().on(table.userId, table.scheduleStatus, table.sequence),
  ],
);
