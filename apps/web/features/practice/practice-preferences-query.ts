import {
  type PracticePreferences,
  practicePreferencesSchema,
  type UpdatePracticePreferencesBody,
} from '@notefinder/contracts';

import { browserApi } from '@/lib/api/browser';

/**
 * Reads what follows the signed-in User across devices
 * (`GET /v1/me/practice-preferences`), or the page defaults until the first
 * change.
 */
export function getPracticePreferences(
  signal?: AbortSignal,
): Promise<PracticePreferences> {
  return browserApi('/me/practice-preferences', {
    schema: practicePreferencesSchema,
    signal,
  });
}

/** Writes whichever preferences changed (`PATCH /v1/me/practice-preferences`). */
export function updatePracticePreferences(
  body: UpdatePracticePreferencesBody,
): Promise<PracticePreferences> {
  return browserApi('/me/practice-preferences', {
    method: 'PATCH',
    body,
    schema: practicePreferencesSchema,
  });
}
