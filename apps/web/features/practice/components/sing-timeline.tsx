'use client';

import type { TrackNote } from '@notefinder/contracts';

import {
  NoteTimeline,
  type TimelineClock,
} from '@/features/timeline/components/note-timeline';

import { useSingVoice } from '../hooks/use-sing-voice';
import type { PlaybackSource } from '../mic-controller';
import { SingReadout } from './sing-readout';

/**
 * The note timeline that follows the mic: in listen mode it is the plain
 * timeline; with the mic on it is drawn in sing mode (labeled lanes and the
 * user's voice line) and the target and detected notes are written above it.
 */
export function SingTimeline({
  notes,
  playback,
  ...timeline
}: {
  notes: readonly TrackNote[];
  playback: PlaybackSource;
  label: string;
  clock?: TimelineClock;
  onScrub?: (seconds: number) => void;
  className?: string;
}) {
  const voice = useSingVoice();

  return (
    <div className="flex flex-col gap-2">
      {voice ? <SingReadout notes={notes} playback={playback} /> : null}
      <NoteTimeline notes={notes} voice={voice} {...timeline} />
    </div>
  );
}
