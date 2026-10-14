'use client';

import { SettingsIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { type RefObject, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { PlaybackController } from '../playback/playback-controller';
import { YOUTUBE_SQUARE_PX } from '../player/player-port';
import { usePlaybackState } from '../stores/playback-store';
import { DockPlayButton } from './dock-play-button';
import { DockProgressTrack } from './dock-progress-track';

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
    loading: () => <Skeleton className="size-10 shrink-0 rounded-full" />,
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
 * play and pause, the progress track and the Settings menu. On a phone the
 * play button and the progress track are the first row, and the video square
 * sits beside a column of controls; from `md` it is one row. With the video
 * hidden it is one line everywhere. The video mounts into `hostRef`, which
 * stays in the page even when hidden, so showing it again needs no reload.
 */
export function PracticeDock({
  controller,
  hostRef,
  videoId,
}: {
  controller: PlaybackController | null;
  hostRef: RefObject<HTMLDivElement | null>;
  videoId: string;
}) {
  const t = useTranslations('tracks.practice.dock');
  const hidden = usePlaybackState((state) => state.videoHidden);
  const status = usePlaybackState((state) => state.status);
  const dock = useRef<HTMLDivElement>(null);
  usePublishDockHeight(dock);

  return (
    <section
      ref={dock}
      aria-label={t('label')}
      data-hidden={hidden}
      className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-4xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl p-2 [grid-template-areas:'play_progress''video_controls'] data-[hidden=true]:grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:data-[hidden=true]:grid-cols-[auto_minmax(0,1fr)_auto] data-[hidden=true]:[grid-template-areas:'play_progress_controls'] md:[grid-template-areas:'video_play_progress_controls'] md:data-[hidden=true]:[grid-template-areas:'play_progress_controls']"
    >
      <div
        ref={hostRef}
        data-testid="dock-video"
        style={{ width: YOUTUBE_SQUARE_PX, height: YOUTUBE_SQUARE_PX }}
        className="overflow-hidden rounded-lg bg-muted [grid-area:video] data-[hidden=true]:hidden"
        data-hidden={hidden}
      />
      <div className="flex justify-center [grid-area:play]">
        <DockPlayButton controller={controller} />
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
      <div className="flex flex-col items-end gap-1 self-start [grid-area:controls] md:flex-row md:self-center">
        <StreakRing playing={status === 'playing'} />
        <DockSettings controller={controller} videoId={videoId} />
      </div>
    </section>
  );
}
