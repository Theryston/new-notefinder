import { Module } from '@nestjs/common';
import { StripeCatalogService } from '../../integrations/stripe/stripe-catalog.service.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { AdminPlansController } from './admin-plans.controller.js';
import { AdminPlansService } from './admin-plans.service.js';
import { PlansController } from './plans.controller.js';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [WebRevalidationModule],
  controllers: [PlansController, AdminPlansController],
  providers: [
    PlansRepository,
    PlansService,
    AdminPlansService,
    StripeCatalogService,
  ],
})
export class PlansModule {}
