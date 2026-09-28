import { PASSWORD_MIN_LENGTH } from '@notefinder/contracts/auth-rules';

/** 0: too short to be accepted, 1: weak, 2: fair, 3: strong. */
export type PasswordStrength = 0 | 1 | 2 | 3;

const LONG_PASSWORD = 12;

const characterClasses = (password: string): number =>
  [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((pattern) =>
    pattern.test(password),
  ).length;

/**
 * A rough hint shown while typing. The API only enforces the minimum
 * length, so this never blocks the form.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;
  const variety = characterClasses(password);
  if (password.length >= LONG_PASSWORD && variety >= 3) return 3;
  if (password.length >= LONG_PASSWORD || variety >= 3) return 2;
  return 1;
}
