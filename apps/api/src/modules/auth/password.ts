import bcrypt from 'bcryptjs';
import {
  hashPassword as hashScrypt,
  verifyPassword as verifyScrypt,
} from 'better-auth/crypto';

// `$2a$`/`$2b$` (bcryptjs) and `$2y$` (PHP/OpenBSD) followed by the cost.
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;

/**
 * Legacy (NextAuth) passwords are bcrypt hashes. They are imported as-is and
 * replaced by a scrypt hash on the user's next successful sign-in.
 */
export const isLegacyPasswordHash = (hash: string): boolean =>
  BCRYPT_HASH.test(hash);

/** New passwords use Better Auth's default (scrypt). */
export const hashPassword = (password: string): Promise<string> =>
  hashScrypt(password);

/** Accepts Better Auth's scrypt hashes and legacy bcrypt hashes. */
export const verifyPassword = async ({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> => {
  if (isLegacyPasswordHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  return verifyScrypt({ hash, password });
};
