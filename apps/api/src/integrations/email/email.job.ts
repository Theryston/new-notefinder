import { z } from 'zod';

export const EMAIL_QUEUE = 'email';
export const EMAIL_JOB = 'send';

export const emailMessageSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(998),
  html: z.string().min(1),
  text: z.string().min(1),
  sendBefore: z.iso.datetime().optional(),
  tags: z
    .array(z.object({ name: z.string().min(1), value: z.string().min(1) }))
    .optional(),
});

export type EmailMessage = z.infer<typeof emailMessageSchema>;
