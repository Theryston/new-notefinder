import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Blank counts as unset, so `KEY=` in a .env file doesn't fail the boot.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );

// Only for NODE_ENV=test, so test runners (e.g. the e2e suite) boot without a
// secret. Never used anywhere else: the schema requires a real one.
const TEST_AUTH_SECRET = 'test-only-better-auth-secret-not-for-real-use';

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

// S3-compatible file storage (MinIO locally, AWS S3 in production). The
// endpoint and path style only matter for S3-compatible servers, so AWS
// doesn't need them.
const S3_MANDATORY = [
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_URL',
] as const;
const S3_OPTIONAL = ['S3_ENDPOINT', 'S3_FORCE_PATH_STYLE'] as const;

const BRIGHT_DATA_KEYS = [
  'BRIGHT_DATA_PROXY_HOST',
  'BRIGHT_DATA_PROXY_PORT',
  'BRIGHT_DATA_PROXY_USERNAME',
  'BRIGHT_DATA_PROXY_PASSWORD',
] as const;

// https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html
const S3_BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const envSchema = z
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
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
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
    // Signs session cookies and encrypts auth data. Random, at least 32
    // characters (`openssl rand -base64 32`); rotating it signs everyone out.
    BETTER_AUTH_SECRET: optional(z.string().min(32)),
    // Public base URL of this API (no /v1): OAuth callbacks and auth links
    // are built from it.
    BETTER_AUTH_URL: z
      .url()
      .default('http://localhost:3333')
      .transform((url) => url.replace(/\/+$/, '')),
    // Registrable domain shared by the web and the API (e.g.
    // `notefinder.com.br` for web on the apex and API on a subdomain). When
    // set, the session cookie is sent to both, so the web server can forward
    // it. Unset: host-only cookie on the API's host.
    AUTH_COOKIE_DOMAIN: optional(z.string().min(1)),
    // Google sign-in is enabled only when both are set.
    GOOGLE_CLIENT_ID: optional(z.string().min(1)),
    GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
    // Transactional email through Resend. Required in production; elsewhere,
    // when unset, emails (including one-time codes) are logged instead.
    RESEND_API_KEY: optional(z.string().min(1)),
    EMAIL_FROM: z
      .string()
      .min(3)
      .default('notefinder <noreply@notefinder.com.br>'),
    // Optional here so the schema itself doesn't force a storage config on
    // every consumer; the group below must be complete once any of it is set,
    // and the storage module refuses to boot without it.
    S3_ENDPOINT: optional(z.url({ protocol: /^https?$/ })),
    S3_REGION: optional(z.string().min(1)),
    S3_BUCKET: optional(z.string().regex(S3_BUCKET_NAME)),
    S3_ACCESS_KEY_ID: optional(z.string().min(1)),
    S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
    // MinIO needs path-style addressing (`host/bucket/key`); AWS doesn't.
    S3_FORCE_PATH_STYLE: optional(z.stringbool()),
    // Base URL the stored objects are served from, without the key: the
    // files domain in production, the bucket's path on MinIO locally.
    S3_PUBLIC_URL: optional(
      z
        .url({ protocol: /^https?$/ })
        .transform((url) => url.replace(/\/+$/, '')),
    ),
    // Private Music catalog WebSocket (`ws://host:port`), dialed once at
    // boot and multiplexed for every public search. Optional so existing
    // suites boot without a catalog; the search endpoint fails with
    // `INTERNAL_ERROR` until it is set. Required in production.
    MUSIC_CATALOG_URL: optional(z.url({ protocol: /^wss?$/ })),
    // API key sent as `Authorization: Bearer <key>` in the catalog
    // handshake. At least 32 characters, like the catalog's own keys.
    MUSIC_CATALOG_API_KEY: optional(z.string().min(32)),
    // How long one catalog search may take before the API gives up.
    // No default in the schema (so existing env snapshots keep passing);
    // the client falls back to {@link MUSIC_CATALOG_DEFAULT_TIMEOUT_MS}.
    MUSIC_CATALOG_REQUEST_TIMEOUT_MS: optional(
      z.coerce.number().int().positive(),
    ),
    // Limits on a User's Track requests (admins are exempt) and the longest
    // Recording or video a Processing accepts. Unset, the defaults of
    // `modules/tracks/track-limits.ts` apply: kept out of the schema so the
    // parsed env stays what it was before these existed.
    PROCESSING_ACTIVE_LIMIT: optional(z.coerce.number().int().positive()),
    PROCESSING_NEW_TRACKS_DAILY_LIMIT: optional(
      z.coerce.number().int().positive(),
    ),
    PROCESSING_MAX_DURATION_SECONDS: optional(
      z.coerce.number().int().positive(),
    ),
    // Bright Data proxy for YouTube Music requests, used only when set. All
    // four are needed together, see the check below.
    BRIGHT_DATA_PROXY_HOST: optional(z.string().min(1)),
    BRIGHT_DATA_PROXY_PORT: optional(
      z.coerce.number().int().min(1).max(65_535),
    ),
    BRIGHT_DATA_PROXY_USERNAME: optional(z.string().min(1)),
    BRIGHT_DATA_PROXY_PASSWORD: optional(z.string().min(1)),
  })
  .check((ctx) => {
    const env = ctx.value;
    const anySet = [...S3_MANDATORY, ...S3_OPTIONAL].some(
      (key) => env[key] !== undefined,
    );
    for (const key of S3_MANDATORY) {
      if (anySet && env[key] === undefined) {
        ctx.issues.push({
          code: 'custom',
          input: env,
          path: [key],
          message: 'Required when any S3_ variable is set',
        });
      }
    }
    const brightDataAnySet = BRIGHT_DATA_KEYS.some(
      (key) => env[key] !== undefined,
    );
    for (const key of BRIGHT_DATA_KEYS) {
      if (brightDataAnySet && env[key] === undefined) {
        ctx.issues.push({
          code: 'custom',
          input: env,
          path: [key],
          message: 'Required when any BRIGHT_DATA_PROXY_ variable is set',
        });
      }
    }
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' || env.REVALIDATE_SECRET !== undefined,
    {
      path: ['REVALIDATE_SECRET'],
      message: 'Required in production',
    },
  )
  .refine(
    (env) => env.NODE_ENV === 'test' || env.BETTER_AUTH_SECRET !== undefined,
    { path: ['BETTER_AUTH_SECRET'], message: 'Required' },
  )
  .refine(
    (env) => env.NODE_ENV !== 'production' || env.RESEND_API_KEY !== undefined,
    { path: ['RESEND_API_KEY'], message: 'Required in production' },
  )
  .refine(
    (env) =>
      (env.GOOGLE_CLIENT_ID === undefined) ===
      (env.GOOGLE_CLIENT_SECRET === undefined),
    {
      path: ['GOOGLE_CLIENT_SECRET'],
      message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither',
    },
  )
  .transform((env) => ({
    ...env,
    SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? TEST_AUTH_SECRET,
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
