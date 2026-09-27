import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Redis } from 'ioredis';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ENV, type Env } from '../../config/env.js';
import { DATABASE, type Database } from '../../database/database.js';
import { EmailModule } from '../../integrations/email/email.module.js';
import { EmailService } from '../../integrations/email/email.service.js';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';
import { AUTH } from './auth.constants.js';
import { AuthGuard } from './auth.guard.js';
import { createAuth } from './auth.js';

/**
 * Better Auth instance (`AUTH`, whose HTTP handler `configureApp` mounts under
 * `/v1/auth/*`) and the global guards. Import it after `RateLimitModule` so
 * the throttler guard runs first.
 */
@Module({
  imports: [EmailModule],
  providers: [
    {
      provide: AUTH,
      inject: [ENV, DATABASE, REDIS_CLIENT, EmailService],
      useFactory: (
        env: Env,
        db: Database,
        redis: Redis,
        emailService: EmailService,
      ) => createAuth({ env, db, redis, emailService }),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AUTH],
})
export class AuthModule {}
