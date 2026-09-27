import { Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { emailOTP, username } from 'better-auth/plugins';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import { RedisThrottlerStorage } from '../../common/rate-limit/redis-throttler-storage.js';
import type { Env } from '../../config/env.js';
import type { Database } from '../../database/database.js';
import {
  accounts,
  sessions,
  verifications,
} from '../../database/schema/auth.js';
import { users } from '../../database/schema/users.js';
import type { EmailService } from '../../integrations/email/email.service.js';
import { resolveEmailLocale } from '../../integrations/email/email-locale.js';
import {
  AUTH_BASE_PATH,
  CLIENT_IP_HEADER,
  OTP_EXPIRES_IN_SECONDS,
  OTP_LENGTH,
} from './auth.constants.js';
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from './password.js';

const DAY_SECONDS = 24 * 60 * 60;

// Legacy rules: 3-50 characters, letters, digits and underscores. Input is
// lowercased (Better Auth's default normalization), as legacy did.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const isValidUsername = (value: string): boolean =>
  /^[a-z0-9_]+$/i.test(value);

const PASSWORD_SIGN_IN_PATHS = new Set(['/sign-in/email', '/sign-in/username']);
const passwordBodySchema = z.object({ password: z.string() });

export type AuthDependencies = {
  env: Env;
  db: Database;
  redis: Redis;
  emailService: EmailService;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The Better Auth instance behind `/v1/auth/*` (mounted in `setup-app.ts`)
 * and the global `AuthGuard`. Responses under `/v1/auth/*` use Better Auth's
 * own format (the Better Auth clients expect it), not the API error envelope.
 */
export const createAuth = ({
  env,
  db,
  redis,
  emailService,
}: AuthDependencies) => {
  const logger = new Logger('Auth');
  const rateLimitStorage = new RedisThrottlerStorage(redis);

  return betterAuth({
    appName: 'notefinder',
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    // Origins allowed to call auth endpoints with cookies and to be used as
    // redirect targets (`callbackURL`).
    trustedOrigins: env.WEB_ORIGINS,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    user: {
      additionalFields: {
        // `input: false`: never settable through sign-up or update-user.
        role: {
          type: 'string',
          required: false,
          defaultValue: 'USER',
          input: false,
        },
        dailyPracticeTargetSeconds: {
          type: 'number',
          required: false,
          input: false,
        },
      },
    },
    session: {
      // Legacy (NextAuth JWT) sessions lasted 30 days.
      expiresIn: 30 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    emailAndPassword: {
      enabled: true,
      // No session until the email is verified with the OTP. Also makes
      // sign-up answer the same way for new and existing emails.
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    emailVerification: {
      // Both go through `sendVerificationOTP` below
      // (`overrideDefaultEmailVerification`): a code, not a link.
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID !== undefined &&
      env.GOOGLE_CLIENT_SECRET !== undefined
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    account: {
      // Legacy linked Google to an existing email account. Better Auth only
      // links when Google reports the email as verified, and strips access
      // an unverified local account had accrued before.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    // Passwordless OTP sign-in isn't a notefinder feature.
    disabledPaths: ['/sign-in/email-otp'],
    rateLimit: {
      // Off in tests so suites can sign in repeatedly.
      enabled: env.NODE_ENV !== 'test',
      window: env.RATE_LIMIT_TTL_SECONDS,
      max: env.RATE_LIMIT_MAX,
      // Shared by every instance and fails open when Redis is down, like
      // the global throttler (whose Redis storage it reuses). Better Auth
      // adds stricter per-endpoint rules (e.g. 3 sign-ins per 10s).
      customStorage: {
        consume: async (key, rule) => {
          const record = await rateLimitStorage.increment(
            key,
            rule.window * 1000,
            rule.max,
            0,
            'auth',
          );
          return record.isBlocked
            ? { allowed: false, retryAfter: record.timeToExpire }
            : { allowed: true, retryAfter: null };
        },
      },
    },
    advanced: {
      cookiePrefix: 'notefinder',
      useSecureCookies: env.NODE_ENV === 'production',
      // Web on the apex and API on a subdomain: scoping the cookie to the
      // shared domain lets the web server read and forward it.
      crossSubDomainCookies:
        env.AUTH_COOKIE_DOMAIN === undefined
          ? undefined
          : { enabled: true, domain: env.AUTH_COOKIE_DOMAIN },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      // Same ID format as every other table; imported legacy cuids fit too.
      database: { generateId: () => createId() },
    },
    telemetry: { enabled: false },
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      // Messages only: arguments may carry user data.
      log: (level, message) => {
        if (level === 'error') logger.error(message);
        else if (level === 'warn') logger.warn(message);
        else if (level === 'info') logger.log(message);
        else logger.debug(message);
      },
    },
    plugins: [
      username({
        minUsernameLength: USERNAME_MIN_LENGTH,
        maxUsernameLength: USERNAME_MAX_LENGTH,
        usernameValidator: isValidUsername,
        displayUsername: false,
      }),
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRES_IN_SECONDS,
        allowedAttempts: 5,
        // A database leak doesn't expose live codes.
        storeOTP: 'hashed',
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type !== 'email-verification' && type !== 'forget-password') {
            logger.warn(`Ignoring a "${type}" code request: not enabled`);
            return;
          }
          // Codes triggered by sign-up/sign-in come with only the request.
          const headers = ctx?.headers ?? ctx?.request?.headers;
          // Not awaited: the response must not wait for (or reveal, through
          // its timing) the enqueueing, which can hang while Redis is down.
          emailService
            .sendOtp({
              to: email,
              type,
              otp,
              locale: resolveEmailLocale(headers?.get('accept-language')),
              expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60,
            })
            .catch((error: unknown) => {
              logger.error(
                `Could not enqueue a code email: ${errorMessage(error)}`,
              );
            });
        },
      }),
    ],
    hooks: {
      // Replaces a legacy bcrypt hash with scrypt once the user proved the
      // password, so legacy hashes disappear over time.
      after: createAuthMiddleware(async (ctx) => {
        const userId = ctx.context.newSession?.user.id;
        const body = passwordBodySchema.safeParse(ctx.body);
        if (
          !PASSWORD_SIGN_IN_PATHS.has(ctx.path) ||
          userId === undefined ||
          !body.success
        ) {
          return;
        }
        try {
          const credential = (
            await ctx.context.internalAdapter.findAccounts(userId)
          ).find((account) => account.providerId === 'credential');
          if (
            credential?.password &&
            isLegacyPasswordHash(credential.password)
          ) {
            await ctx.context.internalAdapter.updatePassword(
              userId,
              await hashPassword(body.data.password),
            );
          }
        } catch (error) {
          // The sign-in itself succeeded; try again next time.
          logger.warn(
            `Could not rehash a legacy password: ${errorMessage(error)}`,
          );
        }
      }),
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;

export type AuthSession = NonNullable<
  Awaited<ReturnType<Auth['api']['getSession']>>
>;

export type AuthUser = AuthSession['user'];
