import { createHash, timingSafeEqual } from 'node:crypto';

const BEARER_PATTERN = /^Bearer\s+(\S+)\s*$/i;

// Hashing first gives every key and candidate the same length, which
// timingSafeEqual requires, and keeps the key's length from leaking through
// how long the comparison takes.
const digest = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

/**
 * Builds the check for the handshake's `Authorization: Bearer <key>` header
 * against every configured key. Each key is compared in constant time and all
 * of them are always compared, so the time taken reveals neither how close a
 * guess was nor which key matched.
 */
export const createApiKeyVerifier = (
  keys: readonly string[],
): ((authorization: string | undefined) => boolean) => {
  const keyDigests = keys.map(digest);

  return (authorization) => {
    const key = authorization?.match(BEARER_PATTERN)?.[1];
    if (key === undefined) {
      return false;
    }
    const candidate = digest(key);
    let matched = false;
    for (const keyDigest of keyDigests) {
      matched = timingSafeEqual(candidate, keyDigest) || matched;
    }
    return matched;
  };
};
