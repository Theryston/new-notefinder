import type { z } from 'zod';

/**
 * Parses an env object and throws one readable error listing every invalid
 * variable, so a misconfigured deploy fails at startup instead of on the
 * first request that happens to read the value.
 */
export function parseEnv<TSchema extends z.ZodType>(
  scope: string,
  schema: TSchema,
  values: Record<string, string | undefined>,
): z.output<TSchema> {
  const result = schema.safeParse(values);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      `Invalid ${scope} environment variables:\n${lines.join('\n')}\n` +
        'See apps/web/.env.example for the expected values.',
    );
  }

  return result.data;
}
