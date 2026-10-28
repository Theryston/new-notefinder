import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { CreateCheckoutBody } from '@vozzify/contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  planCatalogSettings,
  planPrices,
  plans,
} from '../../database/schema/plans.js';
import {
  billingCustomers,
  billingEvents,
  subscriptions,
} from '../../database/schema/subscriptions.js';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}
  async lock(userId: string) {
    await this.txHost.tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`billing-${userId}`}))`,
    );
  }
  async current(userId: string) {
    const rows = await this.txHost.tx
      .select({ contract: subscriptions, copy: plans.copy })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.userId, userId));
    return rows[0];
  }
  async customer(userId: string) {
    const rows = await this.txHost.tx
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId));
    return rows[0];
  }
  async userForCustomer(customer: string) {
    const rows = await this.txHost.tx
      .select({ userId: billingCustomers.userId })
      .from(billingCustomers)
      .where(eq(billingCustomers.stripeCustomerId, customer));
    return rows[0]?.userId;
  }
  async saveCustomer(userId: string, customer: string) {
    await this.txHost.tx
      .insert(billingCustomers)
      .values({ userId, stripeCustomerId: customer })
      .onConflictDoUpdate({
        target: billingCustomers.userId,
        set: { stripeCustomerId: customer },
      });
  }
  async offer(body: CreateCheckoutBody) {
    const rows = await this.txHost.tx
      .select({ plan: plans, price: planPrices })
      .from(plans)
      .innerJoin(
        planPrices,
        and(eq(plans.id, planPrices.planId), eq(planPrices.current, true)),
      )
      .where(eq(plans.id, body.planId));
    const settings = await this.txHost.tx
      .select()
      .from(planCatalogSettings)
      .where(eq(planCatalogSettings.id, 'catalog'));
    return { rows, enabled: settings[0]?.contractingEnabled === true };
  }
  async create(input: typeof subscriptions.$inferInsert) {
    await this.txHost.tx.insert(subscriptions).values(input);
  }
  async update(
    userId: string,
    input: Partial<typeof subscriptions.$inferInsert>,
  ) {
    await this.txHost.tx
      .update(subscriptions)
      .set(input)
      .where(eq(subscriptions.userId, userId));
  }
  async processed(id: string) {
    return (
      (
        await this.txHost.tx
          .select({ id: billingEvents.id })
          .from(billingEvents)
          .where(eq(billingEvents.providerEventId, id))
      ).length > 0
    );
  }
  async markProcessed(id: string) {
    await this.txHost.tx
      .insert(billingEvents)
      .values({ providerEventId: id })
      .onConflictDoNothing();
  }
}
