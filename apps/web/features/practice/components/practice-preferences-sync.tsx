'use client';

import { usePracticePreferencesSync } from '../hooks/use-practice-preferences-sync';

/**
 * Syncs the practice preferences with the account while signed in (and only
 * then). Renders nothing; the wiring lives here because the hook belongs to
 * this feature while the session lives on the Track page.
 */
export function PracticePreferencesSync({
  signedIn,
  userKey,
}: {
  signedIn: boolean;
  userKey: string | null;
}) {
  usePracticePreferencesSync({ signedIn, userKey });
  return null;
}
