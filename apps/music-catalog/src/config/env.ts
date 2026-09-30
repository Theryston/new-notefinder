import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalogDatasetSchema } from '@notefinder/contracts';
import { z } from 'zod';

// Long enough that a key can't be guessed, and that the local placeholder in
// .env.example can't pass for a real one by accident.
const API_KEY_MIN_LENGTH = 32;

const parseApiKeys = (value: string): string[] =>
  value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // 0 lets the OS pick a free port (used by the e2e tests).
  PORT: z.coerce.number().int().min(0).max(65_535).default(3334),
  // Our own Postgres: the music_catalog schema plus, from the bootstrap
  // ticket on, the MusicBrainz tables mbslave restores next to it.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Comma-separated: any listed key opens the handshake, so a key is rotated
  // by listing the new one next to the old one, then dropping the old one.
  API_KEYS: z
    .string()
    .transform(parseApiKeys)
    .pipe(z.array(z.string().min(API_KEY_MIN_LENGTH)).min(1)),
  // Which MusicBrainz data the first import restores. No default: forgetting
  // it in production must not silently restore the small sample.
  CATALOG_DATASET: catalogDatasetSchema,
  // A connection that misses one pong between two pings is dropped, so a
  // dead peer is gone after at most twice this interval.
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  // A request still unanswered after this long gets an INTERNAL error.
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type Env = z.output<typeof envSchema>;

export const parseEnv = (source: Record<string, string | undefined>): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};

// Resolves to apps/music-catalog/.env from both src/config and dist/config.
const dotEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

let cachedEnv: Env | undefined;

/**
 * Parses `process.env` once and caches the result. Outside production and
 * tests, variables from `apps/music-catalog/.env` are loaded first (without
 * overriding variables that are already set), so no dotenv dependency is
 * needed.
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
