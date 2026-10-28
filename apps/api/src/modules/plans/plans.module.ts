import { Module } from '@nestjs/common';
import { StripeCatalogService } from '../../integrations/stripe/stripe-catalog.service.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import {
  AdminBenefitsController,
  AdminPlanBenefitsController,
} from './admin-benefits.controller.js';
import { AdminBenefitsRepository } from './admin-benefits.repository.js';
import { AdminBenefitsService } from './admin-benefits.service.js';
import { AdminPlansController } from './admin-plans.controller.js';
import { AdminPlansService } from './admin-plans.service.js';
import { PlansController } from './plans.controller.js';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [WebRevalidationModule],
  controllers: [
    PlansController,
    AdminPlansController,
    AdminBenefitsController,
    AdminPlanBenefitsController,
  ],
  providers: [
    PlansRepository,
    PlansService,
    AdminPlansService,
    StripeCatalogService,
    AdminBenefitsRepository,
    AdminBenefitsService,
  ],
})
export class PlansModule {}
