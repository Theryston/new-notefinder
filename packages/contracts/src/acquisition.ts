import { z } from 'zod';
import { visitorIdSchema } from './events.js';

/** Campaign values recorded for one arrival, limited to known attribution fields. */
export const campaignTouchSchema = z
  .object({
    utmSource: z.string().max(500).optional(),
    utmMedium: z.string().max(500).optional(),
    utmCampaign: z.string().max(500).optional(),
    utmTerm: z.string().max(500).optional(),
    utmContent: z.string().max(500).optional(),
    gclid: z.string().max(500).optional(),
    fbclid: z.string().max(500).optional(),
    ttclid: z.string().max(500).optional(),
    msclkid: z.string().max(500).optional(),
    referrer: z.string().max(2048).optional(),
    landingPath: z.string().max(2048).optional(),
  })
  .strict();

export type CampaignTouch = z.infer<typeof campaignTouchSchema>;

/** The sign-up attribution sent on the first authenticated page load. */
export const recordAcquisitionBodySchema = z
  .object({
    visitorId: visitorIdSchema,
    firstTouch: campaignTouchSchema.nullable(),
    lastTouch: campaignTouchSchema.nullable(),
  })
  .strict();

export type RecordAcquisitionBody = z.infer<typeof recordAcquisitionBodySchema>;

export const acquisitionRecordedSchema = z.object({
  recorded: z.literal(true),
});

export type AcquisitionRecorded = z.infer<typeof acquisitionRecordedSchema>;
