'use client';

import type {
  TrackDetail,
  TrackLyrics,
  TrackNotes,
} from '@notefinder/contracts';
import { MicOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsFloat, useQueryState } from 'nuqs';
import { useEffect, useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { NoteTimeline } from '@/features/timeline/components/note-timeline';

import { usePlayback } from '../hooks/use-playback';
import { usePlaybackShortcuts } from '../hooks/use-playback-shortcuts';
import { noteRangeOf } from '../note-summary';
import { playbackClock } from '../playback/playback-clock';
import type { PlaybackController } from '../playback/playback-controller';
import { usePlaybackState } from '../stores/playback-store';
import { PracticeDock } from './practice-dock';
import { TimedLyrics } from './timed-lyrics';
import { TIMELINE_BOX_CLASS } from './timeline-box-class';

/** What a Track with no vocal notes shows in place of the timeline. */
function NoVoice() {
  const t = useTranslations('tracks.practice.noVoice');

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-12 text-center">
      <MicOffIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="max-w-md text-muted-foreground text-sm">
        {t('description')}
      </p>
    </div>
  );
}

function TrackTimeline({
  header,
  notes,
  failed,
  controller,
}: {
  header: TrackDetail;
  notes: TrackNotes | undefined;
  failed: boolean;
  controller: PlaybackController | null;
}) {
  const t = useTranslations('tracks.practice');
  if (notes === undefined) {
    return failed ? (
      <p role="alert" className="text-muted-foreground text-sm">
        {t('loadError')}
      </p>
    ) : (
      <Skeleton className={TIMELINE_BOX_CLASS} />
    );
  }
  const range = noteRangeOf(notes.notes);
  const label = range
    ? t('timeline.label', {
        title: header.title,
        count: notes.notes.length,
        low: range.low,
        high: range.high,
      })
    : t('timeline.labelEmpty', { title: header.title });

  return (
    <NoteTimeline
      notes={notes.notes}
      label={label}
      clock={controller ? playbackClock : undefined}
      onScrub={controller?.seek}
      className={TIMELINE_BOX_CLASS}
    />
  );
}

/** The length the dock shows until the player knows it, in seconds. */
function durationSecondsOf(header: TrackDetail, notes: TrackNotes | undefined) {
  if (header.durationMs !== null) return header.durationMs / 1000;
  const last = notes?.notes.at(-1);
  return last ? last.end : 0;
}

function usePracticeUrlState(controller: PlaybackController | null) {
  const scrollTarget = useRef<HTMLDivElement>(null);
  const initialSeekApplied = useRef(false);
  const [timelineFocus] = useQueryState('timeline-focus', parseAsBoolean);
  const [time] = useQueryState('time', parseAsFloat);
  const playbackStatus = usePlaybackState((state) => state.status);

  useEffect(() => {
    if (timelineFocus) {
      scrollTarget.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [timelineFocus]);

  useEffect(() => {
    if (
      controller &&
      playbackStatus === 'ready' &&
      time !== null &&
      !initialSeekApplied.current
    ) {
      controller.seek(time);
      initialSeekApplied.current = true;
    }
  }, [controller, playbackStatus, time]);

  return scrollTarget;
}

/**
 * The practice view below the title row: the note timeline (or the "no voice"
 * message for a Track without notes) and the dock that plays the Track's
 * video. The timeline follows the dock's player and can be dragged to seek;
 * the page leaves room under it for the dock, which floats.
 */
export function PracticeBody({
  header,
  notes,
  lyrics,
  failed,
  lyricsFailed,
  lyricsPending,
  fakePlayer,
}: {
  header: TrackDetail;
  notes: TrackNotes | undefined;
  lyrics: TrackLyrics | undefined;
  failed: boolean;
  lyricsFailed: boolean;
  lyricsPending: boolean;
  /** The e2e build's flag: play with a clock instead of YouTube. */
  fakePlayer: boolean;
}) {
  const t = useTranslations('tracks.practice');
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = usePlayback({
    hostRef,
    videoId: header.youtubeVideoId,
    durationSeconds: durationSecondsOf(header, notes),
    fake: fakePlayer,
  });
  usePlaybackShortcuts(controller);
  const scrollTarget = usePracticeUrlState(controller);

  return (
    <div className="flex flex-col gap-6 pb-[calc(var(--dock-height,0px)+max(0.75rem,env(safe-area-inset-bottom))+0.75rem)]">
      <div
        ref={scrollTarget}
        data-testid="track-timeline"
        className="scroll-mt-6"
      >
        {header.hasNotes ? (
          <TrackTimeline
            header={header}
            notes={notes}
            failed={failed}
            controller={controller}
          />
        ) : (
          <NoVoice />
        )}
      </div>
      {lyricsFailed ? (
        <p role="alert" className="text-muted-foreground text-sm">
          {t('loadError')}
        </p>
      ) : lyricsPending && lyrics === undefined ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : (
        <TimedLyrics
          lyrics={lyrics}
          onSeek={(seconds) => controller?.seek(seconds)}
        />
      )}
      {header.youtubeVideoId === null ? null : (
        <PracticeDock
          controller={controller}
          hostRef={hostRef}
          videoId={header.youtubeVideoId}
        />
      )}
    </div>
  );
}
