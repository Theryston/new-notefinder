'use client';

import type {
  TrackDetail,
  TrackLyrics,
  TrackNotes,
} from '@notefinder/contracts';
import { MicOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { KaraokeLine } from '@/features/lyrics/components/karaoke-line';
import { LyricsBlock } from '@/features/lyrics/components/lyrics-block';
import { SingTimeline } from '@/features/practice/components/sing-timeline';

import { usePlayback } from '../hooks/use-playback';
import { usePlaybackShortcuts } from '../hooks/use-playback-shortcuts';
import { useTimelineFocus } from '../hooks/use-shared-link';
import { loopRange } from '../listening/listening-math';
import { useLoop } from '../listening/loop-store';
import { useListeningTools } from '../listening/use-listening-tools';
import { noteRangeOf } from '../note-summary';
import { playbackClock } from '../playback/playback-clock';
import type { PlaybackController } from '../playback/playback-controller';
import { playbackStore } from '../stores/playback-store';
import { useTranspose } from '../stores/transpose-store';
import { creditText } from '../track-credit';
import { transposeNotes } from '../transpose/transpose';
import { ListeningActions } from './listening-actions';
import { PracticeDock } from './practice-dock';
import { SharedMomentSeek } from './shared-moment-seek';
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
  const semitones = useTranspose();
  const shifted = useMemo(
    () => (notes ? transposeNotes(notes.notes, semitones) : []),
    [notes, semitones],
  );
  if (notes === undefined) {
    return failed ? (
      <p role="alert" className="text-muted-foreground text-sm">
        {t('loadError')}
      </p>
    ) : (
      <Skeleton className={TIMELINE_BOX_CLASS} />
    );
  }
  const range = noteRangeOf(shifted);
  const label = range
    ? t('timeline.label', {
        title: header.title,
        count: notes.notes.length,
        low: range.low,
        high: range.high,
      })
    : t('timeline.labelEmpty', { title: header.title });

  return (
    <SingTimeline
      notes={shifted}
      playback={playbackStore}
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

/**
 * The Timed lyrics: the karaoke line goes under the timeline, the whole block
 * below it. Both follow the player and a click on a line seeks there. Nothing
 * shows for a Track without lyrics.
 */
function TrackLyricsBlock({
  lyrics,
  controller,
}: {
  lyrics: TrackLyrics | undefined;
  controller: PlaybackController | null;
}) {
  if (lyrics === undefined || lyrics.lines.length === 0) return null;
  return (
    <LyricsBlock
      lines={lyrics.lines}
      clock={playbackClock}
      onSeek={
        controller
          ? (seconds) => {
              const line = lyrics.lines.find((item) => item.start === seconds);
              if (
                line &&
                useLoop.getState().range &&
                matchMedia(
                  '(max-width: 767px), (max-height: 600px) and (orientation: landscape)',
                ).matches
              ) {
                useLoop.setState({
                  range: loopRange(
                    line.start,
                    line.end,
                    playbackStore.getState().duration,
                  ),
                });
              }
              controller.seek(seconds);
            }
          : undefined
      }
    />
  );
}

/**
 * The practice view below the title row: the note timeline (or the "no voice"
 * message for a Track without notes), the lyrics and the dock that plays the
 * Track's video. The timeline follows the dock's player and can be dragged to
 * seek; the page leaves room under it for the dock, which floats.
 */
export function PracticeBody({
  header,
  notes,
  lyrics,
  lyricsLoading,
  failed,
  fakePlayer,
}: {
  header: TrackDetail;
  notes: TrackNotes | undefined;
  lyrics: TrackLyrics | undefined;
  /** The lyrics are still being read: their slot is held. */
  lyricsLoading: boolean;
  failed: boolean;
  /** The e2e build's flag: play with a clock instead of YouTube. */
  fakePlayer: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = usePlayback({
    hostRef,
    videoId: header.youtubeVideoId,
    durationSeconds: durationSecondsOf(header, notes),
    fake: fakePlayer,
  });
  usePlaybackShortcuts(controller);
  useListeningTools(controller);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  // The timeline block is on screen once its notes loaded or failed to.
  useTimelineFocus(
    timelineRef,
    header.hasNotes && (notes !== undefined || failed),
  );
  const hasLyrics = lyrics !== undefined && lyrics.lines.length > 0;

  return (
    <div
      ref={fullscreenRef}
      className="practice-fullscreen flex flex-col gap-6 bg-background pb-[calc(var(--dock-height,0px)+max(0.75rem,env(safe-area-inset-bottom))+0.75rem)]"
    >
      {header.hasNotes ? (
        <div ref={timelineRef} className="flex scroll-mt-20 flex-col gap-3">
          <ListeningActions
            notes={notes?.notes ?? []}
            controller={controller}
            container={fullscreenRef}
          />
          <TrackTimeline
            header={header}
            notes={notes}
            failed={failed}
            controller={controller}
          />
          {hasLyrics ? (
            <KaraokeLine lines={lyrics.lines} clock={playbackClock} />
          ) : (
            lyricsLoading && <div aria-hidden="true" className="min-h-8" />
          )}
        </div>
      ) : (
        <NoVoice />
      )}
      <SharedMomentSeek controller={controller} />
      {hasLyrics ? (
        <div className="practice-lyrics">
          <TrackLyricsBlock lyrics={lyrics} controller={controller} />
        </div>
      ) : null}
      {header.youtubeVideoId === null ? null : (
        <PracticeDock
          controller={controller}
          hostRef={hostRef}
          videoId={header.youtubeVideoId}
          trackKey={header.key}
          trackTitle={header.title}
          artistText={creditText(header.artistCredit)}
        />
      )}
    </div>
  );
}
