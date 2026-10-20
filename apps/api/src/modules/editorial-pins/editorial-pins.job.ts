import { LOCALES, localeSchema } from '@notefinder/contracts';
import { z } from 'zod';

// A pin going live or ending changes the home a visitor sees at that exact
// moment, so the web cache of the affected locales is revalidated then, not at
// the next hourly regeneration. See docs/adr/0012-editorial-pins-read-time-overlay.md.

export const EDITORIAL_PIN_QUEUE = 'editorial-pins';
export const INVALIDATE_HOME_FOR_PIN_JOB = 'invalidate-home-for-pin';

export const invalidateHomeForPinJobSchema = z.object({
  locales: z.array(localeSchema).min(1).max(LOCALES.length),
});

export type InvalidateHomeForPinJob = z.infer<
  typeof invalidateHomeForPinJobSchema
>;
