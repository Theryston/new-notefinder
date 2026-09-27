import { getClientEnv, getSiteUrl } from '@/lib/env/client';
import { getServerEnv } from '@/lib/env/server';

// Runs once when the server boots: fail fast on a misconfigured deploy.
export function register() {
  getServerEnv();
  getClientEnv();
  getSiteUrl();
}
