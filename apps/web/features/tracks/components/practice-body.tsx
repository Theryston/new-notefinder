'use client';

import type { TrackDetail, TrackNotes } from '@notefinder/contracts';
import { MicOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { NoteTimeline } from '@/features/timeline/components/note-timeline';

import { usePlayback } from '../hooks/use-playback';
import { usePlaybackShortcuts } from '../hooks/use-playback-shortcuts';
import { noteRangeOf } from '../note-summary';
import { playbackClock } from '../playback/playback-clock';
import type { PlaybackController } from '../playback/playback-controller';
import { playbackStore, usePlaybackState } from '../stores/playback-store';
import { transposeNotes } from '../transpose';
import { loadTrackTranspose } from '../transpose-storage';
import { PracticeDock } from './practice-dock';
import { TIMELINE_BOX_CLASS } from './timeline-box-class';
import { VocalRangeStrip } from './vocal-range-strip';

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

/**
 * The practice view below the title row: the note timeline (or the "no voice"
 * message for a Track without notes) and the dock that plays the Track's
 * video. The timeline follows the dock's player and can be dragged to seek;
 * the page leaves room under it for the dock, which floats.
 */
export function PracticeBody({
  header,
  notes,
  failed,
  fakePlayer,
}: {
  header: TrackDetail;
  notes: TrackNotes | undefined;
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
  const transpose = usePlaybackState((state) => state.transpose);
  useEffect(() => {
    const value = loadTrackTranspose(header.id);
    playbackStore.setState({ transpose: value });
  }, [header.id]);
  usePlaybackShortcuts(controller);

  return (
    <div className="flex flex-col gap-6 pb-[calc(var(--dock-height,0px)+max(0.75rem,env(safe-area-inset-bottom))+0.75rem)]">
      {header.hasNotes ? (
        <>
          <TrackTimeline
            header={header}
            notes={
              notes
                ? { notes: transposeNotes(notes.notes, transpose) }
                : undefined
            }
            failed={failed}
            controller={controller}
          />
          {header.vocalRange ? (
            <VocalRangeStrip range={header.vocalRange} transpose={transpose} />
          ) : null}
        </>
      ) : (
        <NoVoice />
      )}
      {header.youtubeVideoId === null ? null : (
        <PracticeDock
          controller={controller}
          hostRef={hostRef}
          videoId={header.youtubeVideoId}
          trackId={header.id}
        />
      )}
    </div>
  );
}
