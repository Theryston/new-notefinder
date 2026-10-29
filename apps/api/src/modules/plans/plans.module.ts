import { Module } from '@nestjs/common';
import { StripeBillingService } from '../../integrations/stripe/stripe-billing.service.js';
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
import { SubscriptionChangesService } from './subscription-changes.service.js';
import {
  StripeWebhookController,
  SubscriptionsController,
} from './subscriptions.controller.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  imports: [WebRevalidationModule],
  controllers: [
    PlansController,
    SubscriptionsController,
    StripeWebhookController,
    AdminPlansController,
    AdminBenefitsController,
    AdminPlanBenefitsController,
  ],
  providers: [
    PlansRepository,
    SubscriptionsRepository,
    SubscriptionsService,
    SubscriptionChangesService,
    StripeBillingService,
    PlansService,
    AdminPlansService,
    StripeCatalogService,
    AdminBenefitsRepository,
    AdminBenefitsService,
  ],
})
export class PlansModule {}
