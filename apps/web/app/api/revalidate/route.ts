import { createHash, timingSafeEqual } from 'node:crypto';

import type { ApiError, ApiErrorCode } from '@notefinder/contracts';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { getServerEnv } from '@/lib/env/server';

// Next ignores tags longer than 256 characters.
const revalidateBodySchema = z.object({
  tags: z.array(z.string().min(1).max(256)).min(1).max(50),
});

function errorResponse(
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  const body: ApiError = { statusCode, code, message, details };
  return Response.json(body, { status: statusCode });
}

// Hashing first makes both buffers the same length, so the comparison time
// doesn't leak the secret's length either.
function secretMatches(received: string, expected: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

/**
 * Called by the API after it changes data the web caches: marks the given
 * cache tags stale (served stale-while-revalidate on the next visit).
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const [scheme, token] = authorization.split(' ');

  if (
    scheme !== 'Bearer' ||
    !token ||
    !secretMatches(token, getServerEnv().REVALIDATE_SECRET)
  ) {
    return errorResponse(
      401,
      'UNAUTHORIZED',
      'Missing or invalid revalidation secret',
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Body must be valid JSON');
  }

  const parsed = revalidateBodySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(
      400,
      'VALIDATION_FAILED',
      'Invalid revalidation body',
      z.treeifyError(parsed.error),
    );
  }

  const { tags } = parsed.data;
  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }

  return Response.json({ revalidated: tags });
}
