import { Module } from '@nestjs/common';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { WebRevalidationModule } from './integrations/web-revalidation/web-revalidation.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
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
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
