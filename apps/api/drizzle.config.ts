import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/config/env.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  // Must match the runtime client in src/database/database.ts.
  casing: 'snake_case',
  dbCredentials: { url: loadEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
