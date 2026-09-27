import { z } from 'zod';

export const EMAIL_QUEUE = 'email';
export const EMAIL_JOB = 'send';

export const emailMessageSchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(998),
  html: z.string().min(1),
  text: z.string().min(1),
});

export type EmailMessage = z.infer<typeof emailMessageSchema>;
