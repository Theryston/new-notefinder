import { z } from 'zod';

// Consumed only by infrastructure (Coolify, load balancers), never by the web
// or mobile apps, so the shape lives here instead of @notefinder/contracts.

const healthCheckStatusSchema = z.enum(['ok', 'error']);

export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;

export const readinessSchema = z.object({
  status: healthCheckStatusSchema,
  checks: z.object({
    database: healthCheckStatusSchema,
    redis: healthCheckStatusSchema,
  }),
});

export type Readiness = z.infer<typeof readinessSchema>;
