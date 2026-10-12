import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../../integrations/web-revalidation/web-revalidation.module.js';
import { TrackContributorPagesRepository } from './track-contributor-pages.repository.js';
import { TrackContributorPagesService } from './track-contributor-pages.service.js';

@Module({
  imports: [WebRevalidationModule],
  providers: [TrackContributorPagesService, TrackContributorPagesRepository],
  exports: [TrackContributorPagesService],
})
export class TrackContributorPagesModule {}
