'use client';

import type { TrackProcessingState } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { Toaster } from '@/components/ui/sonner';

import { useTrackProcessing } from '../hooks/use-track-processing';
import { isRetryOffered } from '../retry-offer';
import { TrackChosenVideo } from './track-chosen-video';
import { TrackContributors } from './track-contributors';
import { TrackProcessingHeader } from './track-processing-header';
import { TrackProcessingProgress } from './track-processing-progress';
import { TrackRetry } from './track-retry';

/**
 * The Processing page: the Track header, the live progress of its Processing,
 * the video it chose and its Contributors. The state comes from the server and
 * is polled while the Processing runs, so the page follows it without a reload.
 */
export function TrackProcessingView({
  initialState,
}: {
  initialState: TrackProcessingState;
}) {
  const t = useTranslations('tracks.processing');
  const { data: state } = useTrackProcessing(
    initialState.track.id,
    initialState,
  );

  return (
    <div className="flex flex-col gap-8 pb-6 md:pb-8">
      {/* Outlives the retry button, which leaves the page once the retry starts. */}
      <Toaster />
      <TrackProcessingHeader track={state.track} />
      {state.processing === null ? (
        <p className="text-muted-foreground text-sm">{t('none')}</p>
      ) : (
        <>
          <TrackProcessingProgress processing={state.processing} />
          {isRetryOffered(state.processing) ? (
            <TrackRetry trackId={state.track.id} />
          ) : null}
          {state.processing.video === null ? null : (
            <TrackChosenVideo video={state.processing.video} />
          )}
        </>
      )}
      {state.contributors.length > 0 ? (
        <TrackContributors contributors={state.contributors} />
      ) : null}
    </div>
  );
}
