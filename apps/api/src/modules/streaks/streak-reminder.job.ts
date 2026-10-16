import { z } from 'zod';

export const STREAK_REMINDER_QUEUE = 'streak-reminders';
export const STREAK_REMINDER_JOB = 'send-due';
export const streakReminderJobSchema = z.object({}).strict();
