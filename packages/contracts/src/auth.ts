import { z } from 'zod';

import {
  OTP_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from './auth-rules.js';

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_PATTERN);

/**
 * `POST /v1/auth/sign-up/email` (Better Auth). The username is picked in a
 * separate step, once the email is verified.
 */
export const signUpBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export type SignUpBody = z.infer<typeof signUpBodySchema>;

/** `POST /v1/auth/email-otp/verify-email` (Better Auth). */
export const verifyEmailBodySchema = z.object({
  email: z.email(),
  otp: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`)),
});

export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

/** `POST /v1/auth/update-user` with only the username (Better Auth). */
export const setUsernameBodySchema = z.object({ username: usernameSchema });

export type SetUsernameBody = z.infer<typeof setUsernameBodySchema>;
