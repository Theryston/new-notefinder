import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { EditorialPinScheduleService } from './editorial-pin-schedule.service.js';
import { EditorialPinsController } from './editorial-pins.controller.js';
import { EDITORIAL_PIN_QUEUE } from './editorial-pins.job.js';
import { EditorialPinsProcessor } from './editorial-pins.processor.js';
import { EditorialPinsRepository } from './editorial-pins.repository.js';
import { EditorialPinsService } from './editorial-pins.service.js';

/** Editorial pins: the admin API, the invalidations and the live-pin reads. */
@Module({
  imports: [
    BullModule.registerQueue({ name: EDITORIAL_PIN_QUEUE }),
    WebRevalidationModule,
  ],
  controllers: [EditorialPinsController],
  providers: [
    EditorialPinsRepository,
    EditorialPinScheduleService,
    EditorialPinsService,
    EditorialPinsProcessor,
  ],
  exports: [EditorialPinsService],
})
export class EditorialPinsModule {}
