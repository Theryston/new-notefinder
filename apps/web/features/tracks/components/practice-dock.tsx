'use client';

import type { TrackKey } from '@notefinder/contracts';
import { SettingsIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { DockMicButton } from '@/features/practice/components/dock-mic-button';
import { DockMicNotice } from '@/features/practice/components/dock-mic-notice';
import { StreakRingSkeleton } from '@/features/streaks/components/streak-ring-skeleton';

import type { PlaybackController } from '../playback/playback-controller';
import { YOUTUBE_SQUARE_PX } from '../player/player-port';
import { playbackStore, usePlaybackState } from '../stores/playback-store';
import { DockPlayButton } from './dock-play-button';
import { DockProgressTrack } from './dock-progress-track';
import { TrackKeyContext, TransposeChipPlaceholder } from './transpose-chip';

// Loaded after the page too, for the same reason as the Settings menu: its
// placeholder is the chip itself, so the dock paints complete at once.
const TransposePopover = dynamic(
  () => import('./transpose-popover').then((module) => module.TransposePopover),
  { ssr: false, loading: TransposeChipPlaceholder },
);

/** The custom property the page's bottom padding and the timeline follow. */
const DOCK_HEIGHT_VAR = '--dock-height';

// Loaded after the page, on the client only: Base UI's menu is heavy, and
// keeping it out of the first-load JS is what the placeholder below stands in for.
const DockSettings = dynamic(
  () => import('./dock-settings').then((module) => module.DockSettings),
  { ssr: false, loading: SettingsPlaceholder },
);

// Loaded after the page too: the streak ring brings the popover, the
// heartbeat and the celebration along, which a listener does not need to paint.
const StreakRing = dynamic(
  () =>
    import('@/features/streaks/components/streak-ring').then(
      (module) => module.StreakRing,
    ),
  {
    ssr: false,
    loading: StreakRingSkeleton,
  },
);

function SettingsPlaceholder() {
  const t = useTranslations('tracks.practice.dock');

  return (
    <Button variant="ghost" size="icon" disabled aria-label={t('settings')}>
      <SettingsIcon aria-hidden="true" />
    </Button>
  );
}

/** Publishes the dock's height, so the page can leave room for it. */
function usePublishDockHeight(dock: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = dock.current;
    if (!element) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty(
        DOCK_HEIGHT_VAR,
        `${element.getBoundingClientRect().height}px`,
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(DOCK_HEIGHT_VAR);
    };
  }, [dock]);
}

/**
 * The floating glass dock (DESIGN.md "Floating layers"): the YouTube square,
 * play and pause, the progress track, the transpose chip and the Settings menu.
 * Actions sit above the progress track. On a phone they wrap beside the
 * video, with progress across the dock underneath; from `sm` the video spans
 * both rows. The video mounts into `hostRef`.
 */
export function PracticeDock({
  controller,
  hostRef,
  videoId,
  trackKey,
}: {
  controller: PlaybackController | null;
  hostRef: RefObject<HTMLDivElement | null>;
  videoId: string;
  trackKey: TrackKey | undefined;
}) {
  const t = useTranslations('tracks.practice.dock');
  const status = usePlaybackState((state) => state.status);
  const dock = useRef<HTMLDivElement>(null);
  usePublishDockHeight(dock);

  return (
    <section
      ref={dock}
      aria-label={t('label')}
      className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-4xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl p-2 [grid-template-areas:'video_actions''progress_progress'] sm:[grid-template-areas:'video_actions''video_progress']"
    >
      <div
        ref={hostRef}
        data-testid="dock-video"
        style={{ width: YOUTUBE_SQUARE_PX, height: YOUTUBE_SQUARE_PX }}
        className="overflow-hidden rounded-lg bg-muted [grid-area:video]"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2 [grid-area:actions] sm:justify-between sm:gap-3">
        <StreakRing playing={status === 'playing'} />
        <div className="flex items-center gap-1">
          <DockMicButton playback={playbackStore} />
          <DockPlayButton controller={controller} />
          <DockSettings controller={controller} videoId={videoId} />
        </div>
        <TrackKeyContext value={trackKey}>
          <TransposePopover />
        </TrackKeyContext>
      </div>
      <div className="flex min-w-0 [grid-area:progress]">
        {status === 'error' ? (
          <p role="alert" className="self-center text-muted-foreground text-sm">
            {t('error')}
          </p>
        ) : (
          <DockProgressTrack controller={controller} />
        )}
      </div>
      <DockMicNotice />
    </section>
  );
}
