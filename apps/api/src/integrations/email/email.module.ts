import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EMAIL_QUEUE } from './email.job.js';
import { EmailProcessor } from './email.processor.js';
import { EmailService } from './email.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
