import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { WriteBenefitBody } from '@notefinder/contracts';
import { asc, eq, inArray } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { benefits, planBenefits, plans } from '../../database/schema/plans.js';

@Injectable()
export class AdminBenefitsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async listBenefits() {
    const [rows, links] = await Promise.all([
      this.txHost.tx
        .select({
          id: benefits.id,
          copy: benefits.copy,
          status: benefits.status,
        })
        .from(benefits)
        .orderBy(asc(benefits.createdAt), asc(benefits.id)),
      this.txHost.tx
        .select({
          benefitId: planBenefits.benefitId,
          id: plans.id,
          copy: plans.copy,
        })
        .from(planBenefits)
        .innerJoin(plans, eq(plans.id, planBenefits.planId))
        .orderBy(asc(plans.displayOrder), asc(plans.id)),
    ]);
    return rows.map(({ id, copy, status }) => ({
      id,
      copy,
      status,
      plans: links
        .filter((link) => link.benefitId === id)
        .map(({ id: planId, copy: planCopy }) => ({
          id: planId,
          copy: planCopy,
        })),
    }));
  }

  async listPlans() {
    const [rows, links] = await Promise.all([
      this.txHost.tx
        .select({ id: plans.id, copy: plans.copy })
        .from(plans)
        .orderBy(asc(plans.displayOrder), asc(plans.id)),
      this.txHost.tx
        .select({
          planId: planBenefits.planId,
          benefitId: planBenefits.benefitId,
        })
        .from(planBenefits)
        .orderBy(asc(planBenefits.position)),
    ]);
    return rows.map((plan) => ({
      ...plan,
      benefitIds: links
        .filter((link) => link.planId === plan.id)
        .map((link) => link.benefitId),
    }));
  }

  async create(body: WriteBenefitBody) {
    const [row] = await this.txHost.tx
      .insert(benefits)
      .values(body)
      .returning({ id: benefits.id });
    return row;
  }

  async update(benefitId: string, body: WriteBenefitBody) {
    const [row] = await this.txHost.tx
      .update(benefits)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(benefits.id, benefitId))
      .returning({ id: benefits.id });
    return row;
  }

  async remove(benefitId: string) {
    // The foreign key cascade removes every association in the same statement.
    const [row] = await this.txHost.tx
      .delete(benefits)
      .where(eq(benefits.id, benefitId))
      .returning({ id: benefits.id });
    return row;
  }

  async lockPlan(planId: string) {
    const [row] = await this.txHost.tx
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.id, planId))
      .for('update');
    return row;
  }

  async existingBenefits(ids: string[]) {
    if (ids.length === 0) return [];
    return this.txHost.tx
      .select({ id: benefits.id })
      .from(benefits)
      .where(inArray(benefits.id, ids))
      .for('key share');
  }

  async setPlanBenefits(planId: string, benefitIds: string[]) {
    await this.txHost.tx
      .delete(planBenefits)
      .where(eq(planBenefits.planId, planId));
    if (benefitIds.length > 0) {
      await this.txHost.tx.insert(planBenefits).values(
        benefitIds.map((benefitId, position) => ({
          planId,
          benefitId,
          position,
        })),
      );
    }
  }
}
