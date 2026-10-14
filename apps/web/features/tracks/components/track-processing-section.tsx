import type { TrackLyrics, TrackProcessingState } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import type { InitialPractice } from '../practice-queries';
import { TrackProcessingView } from './track-processing-view';

/**
 * The client part of the Track page, given the state the route read (and, for
 * a completed Track, what the practice view renders from). Only
 * the `tracks` messages go to the client (the page's strings and the card's),
 * plus the `errors` a failed action (the heart) toasts, so the RSC payload
 * stays small.
 */
export async function TrackProcessingSection({
  initialState,
  initialPractice,
  initialLyrics,
  fakePlayer,
}: {
  initialState: TrackProcessingState;
  initialPractice: InitialPractice | undefined;
  initialLyrics: TrackLyrics | undefined;
  /** The e2e build's flag: the practice view plays with a fake clock. */
  fakePlayer: boolean;
}) {
  const { errors, tracks } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ errors, tracks }}>
      <TrackProcessingView
        initialState={initialState}
        initialPractice={initialPractice}
        initialLyrics={initialLyrics}
        fakePlayer={fakePlayer}
      />
    </NextIntlClientProvider>
  );
}
