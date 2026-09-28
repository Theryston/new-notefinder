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

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH);

const otpSchema = z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`));

/**
 * `POST /v1/auth/sign-up/email` (Better Auth). The username is picked in a
 * separate step, once the email is verified.
 */
export const signUpBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: passwordSchema,
});

export type SignUpBody = z.infer<typeof signUpBodySchema>;

/**
 * The sign-in form. Like legacy, one field takes the email or the username:
 * the client calls `POST /v1/auth/sign-in/email` or `/sign-in/username`
 * (Better Auth) depending on which it is. The password is only required,
 * not checked against the current rules, so no legacy password stops working.
 */
export const signInBodySchema = z.object({
  emailOrUsername: z.string().trim().min(1),
  password: z.string().min(1),
});

export type SignInBody = z.infer<typeof signInBodySchema>;

/** `POST /v1/auth/email-otp/verify-email` (Better Auth). */
export const verifyEmailBodySchema = z.object({
  email: z.email(),
  otp: otpSchema,
});

export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;

/** `POST /v1/auth/update-user` with only the username (Better Auth). */
export const setUsernameBodySchema = z.object({ username: usernameSchema });

export type SetUsernameBody = z.infer<typeof setUsernameBodySchema>;

/**
 * `POST /v1/auth/email-otp/request-password-reset` (Better Auth): emails a
 * reset code. Answers the same whether the email has an account or not.
 */
export const forgotPasswordBodySchema = z.object({ email: z.email() });

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

/** `POST /v1/auth/email-otp/reset-password` (Better Auth). */
export const resetPasswordBodySchema = z.object({
  email: z.email(),
  otp: otpSchema,
  password: passwordSchema,
});

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
