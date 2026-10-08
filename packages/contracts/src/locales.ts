import { z } from 'zod';

/**
 * The languages notefinder speaks, the same set as the web app's routes and
 * the emails. `en` is the source of truth for messages, not the language
 * every visitor gets. Never rename one: add a new locale instead.
 */
export const LOCALES = ['en', 'pt-BR'] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;
