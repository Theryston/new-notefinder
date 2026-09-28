import { USERNAME_MAX_LENGTH } from '@notefinder/contracts/auth-rules';

const SUFFIX_DIGITS = 4;
// Used when the name has no letter or digit left after slugifying.
const FALLBACK_BASE = 'singer';

/** Lowercase ASCII slug with underscores: "João Silva" → "joao_silva". */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * A likely-free username built from the user's name plus a short random
 * number (legacy suggested one too), always valid for the API's rules.
 */
export function suggestUsername(
  name: string,
  random: () => number = Math.random,
): string {
  const suffix = String(
    10 ** (SUFFIX_DIGITS - 1) +
      Math.floor(random() * 9 * 10 ** (SUFFIX_DIGITS - 1)),
  );
  const base = (slugify(name) || FALLBACK_BASE)
    .slice(0, USERNAME_MAX_LENGTH - suffix.length - 1)
    .replace(/_+$/, '');
  return `${base}_${suffix}`;
}

/**
 * Normalizes what the user types so it matches what the API stores:
 * lowercase, spaces become underscores.
 */
export function normalizeUsernameInput(value: string): string {
  return value.toLowerCase().replace(/\s/g, '_');
}
