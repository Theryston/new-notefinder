import type { TrackProcessingState } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { TrackProcessingView } from './track-processing-view';

/**
 * The client part of the Processing page, given the state the route read. Only
 * the `tracks` messages go to the client (the page's strings and the card's),
 * so the RSC payload stays small.
 */
export async function TrackProcessingSection({
  initialState,
}: {
  initialState: TrackProcessingState;
}) {
  const { tracks } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ tracks }}>
      <TrackProcessingView initialState={initialState} />
    </NextIntlClientProvider>
  );
}
