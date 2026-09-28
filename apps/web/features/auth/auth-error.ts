/**
 * Better Auth error codes the auth screens can hit and translate
 * (`authErrors.<code>`). Anything else falls back to a generic message.
 */
const KNOWN_CODES = [
  'INVALID_EMAIL',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'INVALID_OTP',
  'OTP_EXPIRED',
  'TOO_MANY_ATTEMPTS',
  'USERNAME_IS_ALREADY_TAKEN',
  'INVALID_USERNAME',
  'USERNAME_TOO_SHORT',
  'USERNAME_TOO_LONG',
] as const;

export type AuthErrorCode =
  | (typeof KNOWN_CODES)[number]
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

/** The error Better Auth's client returns (`{ data, error }`). */
export type AuthClientError = {
  code?: string | undefined;
  status?: number | undefined;
};

const isKnownCode = (code: string): code is (typeof KNOWN_CODES)[number] =>
  KNOWN_CODES.some((known) => known === code);

/** Maps a Better Auth client error to the code whose message is shown. */
export function authErrorCode(error: AuthClientError): AuthErrorCode {
  if (error.code !== undefined && isKnownCode(error.code)) return error.code;
  if (error.status === 429) return 'RATE_LIMITED';
  if (error.status === 401) return 'UNAUTHORIZED';
  return 'UNKNOWN';
}

/**
 * Runs a Better Auth client call, turning a thrown failure (network down,
 * CORS) into a returned error like the ones the client reports itself, so
 * forms always leave their pending state with a message.
 */
export async function authRequest<
  Result extends { error: AuthClientError | null },
>(
  request: () => Promise<Result>,
): Promise<Result | { data: null; error: AuthClientError }> {
  try {
    return await request();
  } catch {
    return { data: null, error: {} };
  }
}
