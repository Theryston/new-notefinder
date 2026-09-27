import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const parseTrustProxy = (value: string): boolean | number | string => {
  const trimmed = value.trim();
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
};

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
    WEB_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0),
      )
      .pipe(z.array(z.url()).min(1)),
    SWAGGER_ENABLED: z.stringbool().optional(),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    // Express `trust proxy`: a hop count, `true`/`false`, or a comma-separated
    // list of trusted proxy addresses/subnets. Drives `req.ip`, which is the
    // key for rate limiting.
    TRUST_PROXY: z
      .string()
      .default('loopback, linklocal, uniquelocal')
      .transform(parseTrustProxy),
    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    WEB_URL: z
      .url()
      .default('http://localhost:3000')
      .transform((url) => url.replace(/\/+$/, '')),
    // Blank counts as unset, so `REVALIDATE_SECRET=` doesn't fail the boot.
    REVALIDATE_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32).optional(),
    ),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || env.REVALIDATE_SECRET !== undefined,
    {
      path: ['REVALIDATE_SECRET'],
      message: 'Required in production',
    },
  )
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.output<typeof envSchema>;

/** Injection token for the parsed {@link Env}: `@Inject(ENV) env: Env`. */
export const ENV = Symbol('ENV');

export const parseEnv = (source: Record<string, string | undefined>): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};

// Resolves to apps/api/.env from both src/config and dist/config.
const dotEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

let cachedEnv: Env | undefined;

/**
 * Parses `process.env` once and caches the result. Outside production and
 * tests, variables from `apps/api/.env` are loaded first (without overriding
 * variables that are already set), so no dotenv dependency is needed.
 */
export const loadEnv = (): Env => {
  if (cachedEnv) {
    return cachedEnv;
  }
  const nodeEnv = process.env.NODE_ENV;
  if (
    nodeEnv !== 'production' &&
    nodeEnv !== 'test' &&
    existsSync(dotEnvPath)
  ) {
    process.loadEnvFile(dotEnvPath);
  }
  cachedEnv = parseEnv(process.env);
  return cachedEnv;
};
