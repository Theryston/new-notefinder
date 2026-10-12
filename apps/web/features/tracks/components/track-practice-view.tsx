'use client';

import type { TrackNotes, TrackPracticeHeader } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';
import { MicOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { NoteTimeline } from '@/features/timeline/components/note-timeline';

import { noteRangeOf } from '../note-summary';
import {
  trackNotesQueryOptions,
  trackPracticeQueryOptions,
} from '../track-practice-query';
import { TrackTitleRow } from './track-title-row';

const TIMELINE_BOX_CLASS = 'h-56 w-full rounded-2xl md:h-72';

/** Same-dimension stand-in for the practice view while it loads. */
function TrackPracticeSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-xl sm:size-16" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className={TIMELINE_BOX_CLASS} />
    </div>
  );
}

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
}: {
  header: TrackPracticeHeader;
  notes: TrackNotes | undefined;
  failed: boolean;
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
  const label = [
    t('timeline.label', { title: header.title }),
    range &&
      t('timeline.summary', {
        count: notes.notes.length,
        low: range.low,
        high: range.high,
      }),
  ]
    .filter(Boolean)
    .join('. ');

  return <NoteTimeline notes={notes.notes} label={label} />;
}

/**
 * The practice view of a completed Track: the title row, then the note
 * timeline (or the "no voice" message for a Track without notes). The server
 * hands in what it rendered, so the page paints complete; when the Processing
 * completes while the page is open there is nothing yet and the browser reads
 * both, which is the in-place switch from the Processing view.
 */
export function TrackPracticeView({
  trackId,
  initial,
}: {
  trackId: string;
  initial:
    | { header: TrackPracticeHeader; notes: TrackNotes | undefined }
    | undefined;
}) {
  const t = useTranslations('tracks.practice');
  const header = useQuery(trackPracticeQueryOptions(trackId, initial?.header));
  const notes = useQuery(
    trackNotesQueryOptions(
      trackId,
      header.data?.hasNotes === true,
      initial?.notes,
    ),
  );

  if (header.data === undefined) {
    return header.isError ? (
      <p role="alert" className="text-muted-foreground text-sm">
        {t('loadError')}
      </p>
    ) : (
      <TrackPracticeSkeleton />
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-6 md:pb-8">
      <TrackTitleRow header={header.data} />
      {header.data.hasNotes ? (
        <TrackTimeline
          header={header.data}
          notes={notes.data}
          failed={notes.isError}
        />
      ) : (
        <NoVoice />
      )}
    </div>
  );
}
