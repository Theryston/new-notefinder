import type { Logger } from '@nestjs/common';
import { OTP_LENGTH } from '@notefinder/contracts';
import type { BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';
import type { EmailService } from '../../integrations/email/email.service.js';
import { resolveEmailLocale } from '../../integrations/email/email-locale.js';
import { OTP_EXPIRES_IN_SECONDS } from './auth.constants.js';

type EmailAndPasswordOptions = NonNullable<
  BetterAuthOptions['emailAndPassword']
>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Enqueues an email without awaiting it: the auth response must not wait
 * for (or reveal, through its timing) the enqueueing, which can hang while
 * Redis is down.
 */
const enqueueInBackground = (
  send: Promise<void>,
  logger: Logger,
  what: string,
): void => {
  send.catch((error: unknown) => {
    logger.error(`Could not enqueue ${what}: ${errorMessage(error)}`);
  });
};

/** Email verification and password reset with emailed 6-digit codes. */
export const emailOtpPlugin = (emailService: EmailService, logger: Logger) =>
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
      enqueueInBackground(
        emailService.sendOtp({
          to: email,
          type,
          otp,
          locale: resolveEmailLocale(headers?.get('accept-language')),
          expiresInMinutes: OTP_EXPIRES_IN_SECONDS / 60,
        }),
        logger,
        'a code email',
      );
    },
  });

/**
 * Sign-up answers an existing email like a new one (no enumeration), so the
 * client waits for a verification code that never comes. Tell the owner
 * instead: they already have an account and can sign in or reset the
 * password.
 */
export const notifyExistingUserSignUp =
  (
    emailService: EmailService,
    logger: Logger,
  ): EmailAndPasswordOptions['onExistingUserSignUp'] =>
  async ({ user }, request) => {
    enqueueInBackground(
      emailService.sendAccountExists({
        to: user.email,
        locale: resolveEmailLocale(request?.headers.get('accept-language')),
      }),
      logger,
      'an account-exists email',
    );
  };
