import { Module } from '@nestjs/common';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { MusicCatalogModule } from './integrations/music-catalog/music-catalog.module.js';
import { StorageModule } from './integrations/storage/storage.module.js';
import { WebRevalidationModule } from './integrations/web-revalidation/web-revalidation.module.js';
import { AlbumsModule } from './modules/albums/albums.module.js';
import { ArtistsModule } from './modules/artists/artists.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { TrackMetadataModule } from './modules/track-metadata/track-metadata.module.js';
import { TracksModule } from './modules/tracks/tracks.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    RateLimitModule,
    // After RateLimitModule: global guards run in registration order, so
    // the throttler rejects floods before any session lookup.
    AuthModule,
    WebRevalidationModule,
    StorageModule,
    MusicCatalogModule,
    HealthModule,
    AlbumsModule,
    ArtistsModule,
    SearchModule,
    TracksModule,
    TrackMetadataModule,
    UsersModule,
  ],
})
export class AppModule {}
