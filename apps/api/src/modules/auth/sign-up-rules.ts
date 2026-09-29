import { NAME_MAX_LENGTH, nameSchema } from '@notefinder/contracts';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { z } from 'zod';

const SIGN_UP_PATH = '/sign-up/email';

// Better Auth runs `before` hooks ahead of its own body validation, so the
// body is untrusted here: read only the two fields these rules care about.
const submittedFieldsSchema = z.object({
  name: z.unknown().optional(),
  image: z.unknown().optional(),
});

/**
 * Applies notefinder's sign-up rules to a raw sign-up body and returns the
 * fields to store instead of the submitted ones:
 * - the Avatar is refused, so a new account can't point it at an arbitrary
 *   URL; it only comes from the Avatar upload or the Google profile;
 * - the Name follows the shared Name rule (`nameSchema`), and is stored
 *   trimmed.
 */
export const validateSignUpBody = (body: unknown): { name: string } => {
  const { name, image } = submittedFieldsSchema.safeParse(body).data ?? {};

  // Any value, `null` included: an Avatar is never set at sign-up.
  if (image !== undefined) {
    throw new APIError('BAD_REQUEST', {
      code: 'IMAGE_NOT_ALLOWED',
      message: 'An avatar cannot be set on sign-up',
    });
  }
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) {
    throw new APIError('BAD_REQUEST', {
      code: 'INVALID_NAME',
      message: `The name must have 1 to ${NAME_MAX_LENGTH} characters`,
    });
  }
  return { name: parsedName.data };
};

/**
 * `before` hook of `POST /sign-up/email`. The Avatar is refused rather than
 * dropped: what a hook returns is merged into the request (it can't remove a
 * field), and an explicit error tells a client sending one that it's wrong.
 * Google sign-up doesn't go through this path, so the Google picture stays.
 */
export const enforceSignUpRules = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== SIGN_UP_PATH) return;
  return { context: { body: validateSignUpBody(ctx.body) } };
});
