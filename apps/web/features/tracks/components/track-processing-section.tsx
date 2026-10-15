import type { TrackProcessingState } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import type { InitialPractice } from '../practice-queries';
import { TrackProcessingView } from './track-processing-view';

/**
 * The client part of the Track page, given the state the route read (and, for
 * a completed Track, what the practice view renders from). Only
 * the `tracks`, `practice` and `streaks` messages go to the client,
 * plus the `errors` a failed action (the heart) toasts, so the RSC payload
 * stays small.
 */
export async function TrackProcessingSection({
  initialState,
  initialPractice,
  fakePlayer,
}: {
  initialState: TrackProcessingState;
  initialPractice: InitialPractice | undefined;
  /** The e2e build's flag: the practice view plays with a fake clock. */
  fakePlayer: boolean;
}) {
  const { errors, practice, streaks, tracks } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ errors, practice, streaks, tracks }}>
      <TrackProcessingView
        initialState={initialState}
        initialPractice={initialPractice}
        fakePlayer={fakePlayer}
      />
    </NextIntlClientProvider>
  );
}
