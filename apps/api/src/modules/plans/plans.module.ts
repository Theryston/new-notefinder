import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller.js';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

@Module({
  controllers: [PlansController],
  providers: [PlansRepository, PlansService],
})
export class PlansModule {}
