import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [StorageModule, WebRevalidationModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
