import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import {
  type AdminBenefit,
  type BenefitPlan,
  cacheTags,
  LOCALES,
  type WriteBenefitBody,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { AdminBenefitsRepository } from './admin-benefits.repository.js';

@Injectable()
export class AdminBenefitsService {
  constructor(
    private readonly repository: AdminBenefitsRepository,
    private readonly revalidation: WebRevalidationService,
  ) {}

  list() {
    return this.repository.listBenefits();
  }
  listPlans() {
    return this.repository.listPlans();
  }

  async get(benefitId: string): Promise<AdminBenefit> {
    const benefit = (await this.list()).find((row) => row.id === benefitId);
    if (!benefit) throw new AppException('NOT_FOUND', 'Benefit not found');
    return benefit;
  }

  async create(body: WriteBenefitBody): Promise<AdminBenefit> {
    const row = await this.repository.create(body);
    if (!row)
      throw new AppException('INTERNAL_ERROR', 'Benefit was not created');
    await this.invalidate();
    return this.get(row.id);
  }

  async update(
    benefitId: string,
    body: WriteBenefitBody,
  ): Promise<AdminBenefit> {
    if (!(await this.repository.update(benefitId, body)))
      throw new AppException('NOT_FOUND', 'Benefit not found');
    await this.invalidate();
    return this.get(benefitId);
  }

  async remove(benefitId: string): Promise<void> {
    if (!(await this.repository.remove(benefitId)))
      throw new AppException('NOT_FOUND', 'Benefit not found');
    await this.invalidate();
  }

  async setPlanBenefits(
    planId: string,
    benefitIds: string[],
  ): Promise<BenefitPlan> {
    await this.replaceLinks(planId, benefitIds);
    await this.invalidate();
    const plan = (await this.listPlans()).find((row) => row.id === planId);
    if (!plan) throw new AppException('NOT_FOUND', 'Plan not found');
    return plan;
  }

  @Transactional()
  private async replaceLinks(
    planId: string,
    benefitIds: string[],
  ): Promise<void> {
    if (!(await this.repository.lockPlan(planId)))
      throw new AppException('NOT_FOUND', 'Plan not found');
    if (
      (await this.repository.existingBenefits(benefitIds)).length !==
      benefitIds.length
    ) {
      throw new AppException(
        'VALIDATION_FAILED',
        'One or more benefits do not exist',
      );
    }
    await this.repository.setPlanBenefits(planId, benefitIds);
  }

  private invalidate() {
    return this.revalidation.revalidate([
      cacheTags.plans,
      ...LOCALES.map(cacheTags.planCatalog),
    ]);
  }
}
