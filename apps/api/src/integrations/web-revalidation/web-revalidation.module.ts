import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WEB_REVALIDATION_QUEUE } from './web-revalidation.job.js';
import { WebRevalidationProcessor } from './web-revalidation.processor.js';
import { WebRevalidationService } from './web-revalidation.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: WEB_REVALIDATION_QUEUE })],
  providers: [WebRevalidationService, WebRevalidationProcessor],
  exports: [WebRevalidationService],
})
export class WebRevalidationModule {}
