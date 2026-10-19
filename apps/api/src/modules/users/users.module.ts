import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { UserProfileService } from './user-profile.service.js';
import { UserSitemapController } from './user-sitemap.controller.js';
import { UserSitemapRepository } from './user-sitemap.repository.js';
import { UserSitemapService } from './user-sitemap.service.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

// The public Profile route lives in ProfilesModule: it also needs the
// attempts, and the attempts module depends on tracks, which depend on users.
@Module({
  imports: [StorageModule, WebRevalidationModule],
  controllers: [UsersController, UserSitemapController],
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
