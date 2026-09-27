import { inject } from 'vitest';

// Runs in every worker before the spec is imported, so the env schema (parsed
// once per module graph by `loadEnv`) sees the database from global-setup.ts.
process.env.DATABASE_URL = inject('databaseUrl');
