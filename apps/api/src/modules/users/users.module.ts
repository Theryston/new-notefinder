import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { UserProfileController } from './user-profile.controller.js';
import { UserProfileService } from './user-profile.service.js';
import { UserSitemapController } from './user-sitemap.controller.js';
import { UserSitemapRepository } from './user-sitemap.repository.js';
import { UserSitemapService } from './user-sitemap.service.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [StorageModule, WebRevalidationModule],
  controllers: [UsersController, UserSitemapController, UserProfileController],
  providers: [
    UsersService,
    UsersRepository,
    UserSitemapService,
    UserSitemapRepository,
    UserProfileService,
  ],
  exports: [UsersService, UserProfileService],
})
export class UsersModule {}
