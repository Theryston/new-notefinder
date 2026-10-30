import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { AdminPlanPrice, SaveAdminPlanBody } from '@vozzify/contracts';
import { and, asc, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  benefits,
  planBenefits,
  planCatalogSettings,
  planPrices,
  planSyncOperations,
  plans,
} from '../../database/schema/plans.js';
import {
  subscriptionPriceChanges,
  subscriptions,
} from '../../database/schema/subscriptions.js';
import type { PlanSyncClaim } from './plan-sync-claim.js';
import { fanOutPriceChanges } from './price-change-fanout.repository.js';

type CatalogPlanRecord = Omit<
  typeof plans.$inferSelect,
  'saleEnabled' | 'stripeProductId' | 'pendingSyncId'
> & {
  saleEnabled?: boolean;
  contractingEnabled?: boolean;
  prices: (Omit<typeof planPrices.$inferSelect, 'stripePriceId'> & {
    stripePriceId?: string | null;
  })[];
  benefits: (typeof benefits.$inferSelect)[];
};

@Injectable()
export class PlansRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findPublished(): Promise<CatalogPlanRecord[]> {
    const rows = await this.txHost.tx
      .select()
      .from(plans)
      .where(eq(plans.published, true))
      .orderBy(asc(plans.displayOrder), asc(plans.id));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [prices, linkedBenefits, settings] = await Promise.all([
      this.txHost.tx
        .select()
        .from(planPrices)
        .where(
          and(inArray(planPrices.planId, ids), eq(planPrices.current, true)),
        ),
      this.txHost.tx
        .select({ planId: planBenefits.planId, benefit: benefits })
        .from(planBenefits)
        .innerJoin(benefits, eq(benefits.id, planBenefits.benefitId))
        .where(
          and(inArray(planBenefits.planId, ids), ne(benefits.status, 'hidden')),
        )
        .orderBy(asc(planBenefits.position)),
      this.txHost.tx
        .select({ contractingEnabled: planCatalogSettings.contractingEnabled })
        .from(planCatalogSettings)
        .where(eq(planCatalogSettings.id, 'catalog')),
    ]);
    return rows.map((row) => ({
      ...row,
      saleEnabled: row.saleEnabled,
      contractingEnabled: settings[0]?.contractingEnabled ?? false,
      prices: prices.filter((price) => price.planId === row.id),
      benefits: linkedBenefits
        .filter((link) => link.planId === row.id)
        .map((link) => link.benefit),
    }));
  }
  async list() {
    const [rows, prices, migrations] = await Promise.all([
      this.txHost.tx
        .select({
          id: plans.id,
          kind: plans.kind,
          copy: plans.copy,
          displayOrder: plans.displayOrder,
          trialDays: plans.trialDays,
          published: plans.published,
          saleEnabled: plans.saleEnabled,
          enabledCycles: plans.enabledCycles,
          operation: {
            status: planSyncOperations.status,
            body: planSyncOperations.body,
          },
        })
        .from(plans)
        .leftJoin(
          planSyncOperations,
          eq(planSyncOperations.id, plans.pendingSyncId),
        )
        .orderBy(asc(plans.displayOrder), asc(plans.id)),
      this.txHost.tx
        .select({
          planId: planPrices.planId,
          cycle: planPrices.cycle,
          currency: planPrices.currency,
          amount: planPrices.amount,
        })
        .from(planPrices)
        .where(eq(planPrices.current, true)),
      this.migrationCounts(),
    ]);
    return rows.map((row) => ({
      ...row,
      prices: prices.filter((price) => price.planId === row.id),
      priceMigrations: migrations.find(
        (migration) => migration.planId === row.id,
      ),
    }));
  }

  private migrationCounts() {
    return this.txHost.tx
      .select({
        planId: subscriptions.planId,
        pending: sql<number>`count(*) filter (where ${subscriptionPriceChanges.noticeStatus} not in ('failed', 'uncertain', 'rejected') and ${subscriptionPriceChanges.scheduleStatus} in ('pending', 'scheduled'))::integer`,
        failed: sql<number>`count(*) filter (where ${subscriptionPriceChanges.noticeStatus} in ('failed', 'rejected') or ${subscriptionPriceChanges.scheduleStatus} = 'failed')::integer`,
        uncertain: sql<number>`count(*) filter (where ${subscriptionPriceChanges.noticeStatus} = 'uncertain')::integer`,
      })
      .from(subscriptionPriceChanges)
      .innerJoin(
        subscriptions,
        eq(subscriptions.id, subscriptionPriceChanges.subscriptionId),
      )
      .where(
        inArray(subscriptionPriceChanges.scheduleStatus, [
          'pending',
          'scheduled',
          'failed',
        ]),
      )
      .groupBy(subscriptions.planId);
  }

  async lockOperation(id: string) {
    await this.txHost.tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${id}))`,
    );
  }

  async find(id: string, lock = false) {
    const query = this.txHost.tx
      .select({ kind: plans.kind, pendingSyncId: plans.pendingSyncId })
      .from(plans)
      .where(eq(plans.id, id));
    const rows = lock ? await query.for('update') : await query;
    return rows[0];
  }

  async createDraft(planId: string, body: SaveAdminPlanBody) {
    await this.txHost.tx
      .insert(plans)
      .values({ id: planId, kind: 'paid', copy: body.copy })
      .onConflictDoNothing();
  }

  async operation(id: string) {
    const rows = await this.txHost.tx
      .select({
        planId: planSyncOperations.planId,
        body: planSyncOperations.body,
        status: planSyncOperations.status,
        leaseUntil: planSyncOperations.leaseUntil,
      })
      .from(planSyncOperations)
      .where(eq(planSyncOperations.id, id));
    return rows[0];
  }

  async claim(planId: string, body: SaveAdminPlanBody, leaseToken: string) {
    await this.txHost.tx
      .insert(planSyncOperations)
      .values({ id: body.operationId, planId, body, status: 'pending' })
      .onConflictDoNothing();
    await this.txHost.tx
      .update(planSyncOperations)
      .set({
        status: 'pending',
        leaseUntil: new Date(Date.now() + 120_000),
        leaseToken,
      })
      .where(eq(planSyncOperations.id, body.operationId));
    await this.txHost.tx
      .update(plans)
      .set({ pendingSyncId: body.operationId })
      .where(eq(plans.id, planId));
  }

  async ownsLease(claim: PlanSyncClaim) {
    const rows = await this.txHost.tx
      .select({ id: plans.id })
      .from(plans)
      .innerJoin(
        planSyncOperations,
        eq(plans.pendingSyncId, planSyncOperations.id),
      )
      .where(
        and(
          eq(plans.id, claim.planId),
          eq(planSyncOperations.id, claim.operationId),
          eq(planSyncOperations.leaseToken, claim.leaseToken),
          eq(planSyncOperations.status, 'pending'),
          gt(planSyncOperations.leaseUntil, new Date()),
        ),
      );
    return rows.length > 0;
  }

  async setProduct(planId: string, productId: string) {
    await this.txHost.tx
      .update(plans)
      .set({ stripeProductId: productId })
      .where(eq(plans.id, planId));
  }

  async stagedPrice(id: string) {
    const rows = await this.txHost.tx
      .select({ id: planPrices.id })
      .from(planPrices)
      .where(eq(planPrices.id, id));
    return rows[0];
  }

  async stagePrice(
    input: AdminPlanPrice & {
      id: string;
      planId: string;
      stripePriceId: string;
    },
  ) {
    await this.txHost.tx
      .insert(planPrices)
      .values({ ...input, current: false })
      .onConflictDoNothing();
  }

  async complete(planId: string, body: SaveAdminPlanBody, priceIds: string[]) {
    await this.txHost.tx
      .update(planPrices)
      .set({ current: false })
      .where(eq(planPrices.planId, planId));
    for (const id of priceIds) {
      await this.txHost.tx
        .update(planPrices)
        .set({ current: true })
        .where(eq(planPrices.id, id));
    }
    await fanOutPriceChanges(this.txHost.tx, { planId });
    const { operationId: _, prices: __, ...settings } = body;
    await this.txHost.tx
      .update(plans)
      .set({ ...settings, pendingSyncId: null })
      .where(eq(plans.id, planId));
    await this.txHost.tx
      .update(planSyncOperations)
      .set({ status: 'synced', leaseUntil: null, leaseToken: null })
      .where(eq(planSyncOperations.id, body.operationId));
  }

  async fail(operationId: string) {
    await this.txHost.tx
      .update(planSyncOperations)
      .set({ status: 'failed', leaseUntil: null, leaseToken: null })
      .where(eq(planSyncOperations.id, operationId));
  }

  async contractingEnabled() {
    const rows = await this.txHost.tx
      .select({ contractingEnabled: planCatalogSettings.contractingEnabled })
      .from(planCatalogSettings)
      .where(eq(planCatalogSettings.id, 'catalog'));
    return rows[0]?.contractingEnabled ?? false;
  }

  async setContracting(contractingEnabled: boolean) {
    await this.txHost.tx
      .insert(planCatalogSettings)
      .values({ id: 'catalog', contractingEnabled })
      .onConflictDoUpdate({
        target: planCatalogSettings.id,
        set: { contractingEnabled },
      });
  }

  async currentPrice(planId: string, price: AdminPlanPrice) {
    const rows = await this.txHost.tx
      .select({ id: planPrices.id })
      .from(planPrices)
      .where(
        and(
          isNotNull(planPrices.stripePriceId),
          eq(planPrices.planId, planId),
          eq(planPrices.current, true),
          eq(planPrices.cycle, price.cycle),
          eq(planPrices.currency, price.currency),
          eq(planPrices.amount, price.amount),
        ),
      );
    return rows[0];
  }
}
