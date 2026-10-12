import type { TrackProcessingState } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import type { InitialPractice } from '../practice-queries';
import { TrackProcessingView } from './track-processing-view';

/**
 * The client part of the Track page, given the state the route read (and, for
 * a completed Track, what the practice view renders from). Only
 * the `tracks` messages go to the client (the page's strings and the card's),
 * so the RSC payload stays small.
 */
export async function TrackProcessingSection({
  initialState,
  initialPractice,
}: {
  initialState: TrackProcessingState;
  initialPractice: InitialPractice | undefined;
}) {
  const { tracks } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ tracks }}>
      <TrackProcessingView
        initialState={initialState}
        initialPractice={initialPractice}
      />
    </NextIntlClientProvider>
  );
}
