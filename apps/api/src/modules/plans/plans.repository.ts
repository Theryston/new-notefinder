import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  benefits,
  planBenefits,
  planPrices,
  plans,
} from '../../database/schema/plans.js';

@Injectable()
export class PlansRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findPublished() {
    const rows = await this.txHost.tx
      .select()
      .from(plans)
      .where(eq(plans.published, true))
      .orderBy(asc(plans.displayOrder), asc(plans.id));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [prices, linkedBenefits] = await Promise.all([
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
    ]);
    return rows.map((row) => ({
      ...row,
      prices: prices.filter((price) => price.planId === row.id),
      benefits: linkedBenefits
        .filter((link) => link.planId === row.id)
        .map((link) => link.benefit),
    }));
  }
}
