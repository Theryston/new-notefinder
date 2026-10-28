import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { cacheTags, type SaveAdminPlanBody } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { StripeCatalogService } from '../../integrations/stripe/stripe-catalog.service.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { adminPlanOf } from './admin-plan-mapping.js';
import type { PlanSyncClaim } from './plan-sync-claim.js';
import { PlansRepository } from './plans.repository.js';

@Injectable()
export class AdminPlansService {
  constructor(
    private readonly plans: PlansRepository,
    private readonly stripe: StripeCatalogService,
    private readonly revalidation: WebRevalidationService,
  ) {}

  async list() {
    const [rows, contractingEnabled] = await Promise.all([
      this.plans.list(),
      this.plans.contractingEnabled(),
    ]);
    return { contractingEnabled, plans: rows.map(adminPlanOf) };
  }

  async setContracting(enabled: boolean) {
    await this.plans.setContracting(enabled);
    await this.announce();
    return this.list();
  }

  // A retried create must resolve the same draft before any provider call.
  create(body: SaveAdminPlanBody) {
    return this.save(`plan-${body.operationId}`, body, true);
  }

  async save(planId: string, body: SaveAdminPlanBody, create = false) {
    const claim = {
      planId,
      operationId: body.operationId,
      leaseToken: randomUUID(),
    };
    const completed = await this.prepare(
      planId,
      body,
      create,
      claim.leaseToken,
    );
    if (!completed) {
      try {
        const productId = await this.syncProduct(claim, body);
        const priceIds = await this.syncPrices(planId, productId, body);
        await this.complete(claim, body, { productId, priceIds });
      } catch {
        if (!(await this.failClaim(claim)))
          throw new AppException(
            'CONFLICT',
            'The synchronization claim is no longer current',
          );
        throw new AppException(
          'SERVICE_UNAVAILABLE',
          'Plan synchronization failed; retry the same operation',
        );
      }
    }
    await this.announce();
    const row = (await this.list()).plans.find((plan) => plan.id === planId);
    if (!row) throw new AppException('NOT_FOUND', 'Plan not found');
    return row;
  }

  @Transactional()
  private async prepare(
    planId: string,
    body: SaveAdminPlanBody,
    create: boolean,
    leaseToken: string,
  ) {
    await this.plans.lockOperation(body.operationId);
    if (await this.completedOperation(planId, body)) return true;
    let snapshot = await this.plans.find(planId);
    if (snapshot) this.assertClaimablePlan(snapshot, body.operationId);
    if (create) {
      await this.plans.createDraft(planId, body);
      snapshot ??= await this.plans.find(planId);
    }
    this.assertClaimablePlan(snapshot, body.operationId);
    this.assertClaimablePlan(
      await this.plans.find(planId, true),
      body.operationId,
    );
    if (await this.completedOperation(planId, body)) return true;
    await this.plans.claim(planId, body, leaseToken);
    return false;
  }

  private async completedOperation(planId: string, body: SaveAdminPlanBody) {
    const operation = await this.plans.operation(body.operationId);
    if (
      operation &&
      (operation.planId !== planId || !isDeepStrictEqual(operation.body, body))
    ) {
      throw new AppException(
        'CONFLICT',
        'The operation ID belongs to another change',
      );
    }
    if (operation?.status === 'synced') return true;
    if (operation?.leaseUntil && operation.leaseUntil.getTime() > Date.now()) {
      throw new AppException(
        'CONFLICT',
        'The synchronization is already running',
      );
    }
    return false;
  }

  private assertClaimablePlan(
    plan: Awaited<ReturnType<PlansRepository['find']>>,
    operationId: string,
  ) {
    if (!plan) throw new AppException('NOT_FOUND', 'Plan not found');
    if (plan.kind !== 'paid')
      throw new AppException(
        'VALIDATION_FAILED',
        'Only paid plans have billing offers',
      );
    if (plan.pendingSyncId && plan.pendingSyncId !== operationId)
      throw new AppException(
        'CONFLICT',
        'Retry the pending change before submitting another',
      );
  }

  // Mutable provider copy must follow claim order even after a worker stalls.
  @Transactional()
  private async syncProduct(claim: PlanSyncClaim, body: SaveAdminPlanBody) {
    await this.plans.find(claim.planId, true);
    if (!(await this.plans.ownsLease(claim)))
      throw new AppException(
        'CONFLICT',
        'The synchronization claim is no longer current',
      );
    return this.stripe.syncProduct({
      planId: claim.planId,
      copy: body.copy,
      operationId: claim.operationId,
    });
  }

  private async syncPrices(
    planId: string,
    productId: string,
    body: SaveAdminPlanBody,
  ) {
    const ids: string[] = [];
    for (const price of body.prices) {
      const current = await this.plans.currentPrice(planId, price);
      if (current) {
        ids.push(current.id);
        continue;
      }
      const id = `${body.operationId}-${price.cycle}-${price.currency}`;
      if (!(await this.plans.stagedPrice(id))) {
        const stripePriceId = await this.stripe.ensurePrice({
          ...price,
          productId,
          key: id,
        });
        await this.plans.stagePrice({ ...price, id, planId, stripePriceId });
      }
      ids.push(id);
    }
    return ids;
  }

  @Transactional()
  private async complete(
    claim: PlanSyncClaim,
    body: SaveAdminPlanBody,
    result: { productId: string; priceIds: string[] },
  ) {
    await this.plans.find(claim.planId, true);
    if (!(await this.plans.ownsLease(claim)))
      throw new AppException(
        'CONFLICT',
        'The synchronization claim is no longer current',
      );
    await this.plans.setProduct(claim.planId, result.productId);
    await this.plans.complete(claim.planId, body, result.priceIds);
  }

  @Transactional()
  private async failClaim(claim: PlanSyncClaim) {
    await this.plans.find(claim.planId, true);
    if (!(await this.plans.ownsLease(claim))) return false;
    await this.plans.fail(claim.operationId);
    return true;
  }

  private announce() {
    return this.revalidation.revalidate([cacheTags.plans]);
  }
}
