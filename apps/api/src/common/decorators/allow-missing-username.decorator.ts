import { SetMetadata } from '@nestjs/common';

export const ALLOW_MISSING_USERNAME_KEY = Symbol('ALLOW_MISSING_USERNAME');

/**
 * Lets signed-in users without a username (new accounts, Google sign-ups)
 * reach a private route. Every other private route answers them with
 * `USERNAME_REQUIRED`, so the client sends them to pick one first. Setting
 * the username itself goes through Better Auth (`/v1/auth/update-user`),
 * which the guard doesn't cover.
 */
export const AllowMissingUsername = () =>
  SetMetadata(ALLOW_MISSING_USERNAME_KEY, true);
