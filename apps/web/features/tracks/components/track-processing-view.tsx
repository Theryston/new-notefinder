'use client';

import type { TrackProcessingState } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { Toaster } from '@/components/ui/sonner';

import { useElapsedSince } from '../hooks/use-step-elapsed';
import { useTrackProcessing } from '../hooks/use-track-processing';
import type { InitialPractice } from '../practice-queries';
import { displayedPercent } from '../processing-steps';
import { TrackChosenVideo } from './track-chosen-video';
import { TrackContributors } from './track-contributors';
import { TrackPracticeView } from './track-practice-view';
import { TrackProcessingBanner } from './track-processing-banner';
import { TrackProcessingStatus } from './track-processing-status';

/**
 * The Track page: while the Processing runs, the banner with the progress
 * ring, then what happens now, the video it chose and its Contributors; once
 * it completes, the practice view. The state comes from the server and is
 * polled while the Processing runs, so the page follows it, and switches to
 * the practice view, without a reload.
 */
export function TrackProcessingView({
  initialState,
  initialPractice,
  fakePlayer,
}: {
  initialState: TrackProcessingState;
  initialPractice: InitialPractice | undefined;
  fakePlayer: boolean;
}) {
  const t = useTranslations('tracks.processing');
  const { data: state } = useTrackProcessing(
    initialState.track.id,
    initialState,
  );
  const { processing } = state;
  // One clock for the ring and the estimate, so they never disagree.
  const elapsedMs = useElapsedSince(
    processing === null
      ? ''
      : `${processing.id}/${processing.status}/${processing.resumeFrom ?? ''}`,
  );

  if (processing?.status === 'COMPLETED') {
    return (
      <>
        {/* A toast still showing when the view switches (a retry refused) stays. */}
        <Toaster />
        <TrackPracticeView
          trackId={state.track.id}
          initial={initialPractice}
          fakePlayer={fakePlayer}
        />
      </>
    );
  }

  const percent =
    processing === null
      ? null
      : displayedPercent(processing.status, processing.resumeFrom, elapsedMs);
  const hasAside = processing?.video != null || state.contributors.length > 0;

  return (
    <div className="flex flex-col gap-10 pb-6 md:gap-12 md:pb-8">
      {/* Outlives the retry button, which leaves the page once the retry starts. */}
      <Toaster />
      <TrackProcessingBanner
        track={state.track}
        processing={processing}
        percent={percent}
      />
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-12">
        {processing === null ? (
          <p className="text-muted-foreground text-sm">{t('none')}</p>
        ) : (
          <TrackProcessingStatus
            trackId={state.track.id}
            processing={processing}
            elapsedMs={elapsedMs}
          />
        )}
        {hasAside ? (
          <div className="flex flex-col gap-6">
            {processing?.video == null ? null : (
              <TrackChosenVideo video={processing.video} />
            )}
            {state.contributors.length > 0 ? (
              <TrackContributors contributors={state.contributors} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
