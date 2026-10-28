import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import {
  AdminBenefitsController,
  AdminPlanBenefitsController,
} from './admin-benefits.controller.js';
import { AdminBenefitsRepository } from './admin-benefits.repository.js';
import { AdminBenefitsService } from './admin-benefits.service.js';
import { PlansController } from './plans.controller.js';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [WebRevalidationModule],
  controllers: [
    PlansController,
    AdminBenefitsController,
    AdminPlanBenefitsController,
  ],
  providers: [
    PlansRepository,
    PlansService,
    AdminBenefitsRepository,
    AdminBenefitsService,
  ],
})
export class PlansModule {}
