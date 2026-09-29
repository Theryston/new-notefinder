import { inject } from 'vitest';
import { applyStorageEnv } from './storage-settings.js';

// Runs in every worker before the spec is imported, so the env schema (parsed
// once per module graph by `loadEnv`) sees the database and the storage server
// from global-setup.ts.
process.env.DATABASE_URL = inject('databaseUrl');
applyStorageEnv(inject('storage'));
