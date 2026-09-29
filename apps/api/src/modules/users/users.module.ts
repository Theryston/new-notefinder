import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { ProfileService } from './profile.service.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [WebRevalidationModule],
  controllers: [UsersController],
  providers: [UsersService, ProfileService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
