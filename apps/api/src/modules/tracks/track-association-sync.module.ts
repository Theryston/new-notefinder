import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MusicCatalogModule } from '../../integrations/music-catalog/music-catalog.module.js';
import { TrackAssociationService } from './track-association.service.js';
import { TrackAssociationEventRepository } from './track-association-event.repository.js';
import { TrackAssociationSyncRepository } from './track-association-sync.repository.js';
import { TrackAssociationSyncService } from './track-association-sync.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, MusicCatalogModule],
  providers: [
    TrackAssociationEventRepository,
    TrackAssociationService,
    TrackAssociationSyncRepository,
    TrackAssociationSyncService,
  ],
  exports: [TrackAssociationSyncService],
})
export class TrackAssociationSyncModule {}
