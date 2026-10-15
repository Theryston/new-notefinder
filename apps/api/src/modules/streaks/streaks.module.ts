import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { StreaksController } from './streaks.controller.js';
import { StreaksRepository } from './streaks.repository.js';
import { StreaksService } from './streaks.service.js';

/** The daily practice streak of a User. */
@Module({
  imports: [UsersModule],
  controllers: [StreaksController],
  providers: [StreaksService, StreaksRepository],
})
export class StreaksModule {}
