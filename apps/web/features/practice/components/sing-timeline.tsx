'use client';

import type {
  SubmitPracticeAttemptBody,
  TrackNote,
} from '@notefinder/contracts';
import { type ReactNode, useMemo } from 'react';

import {
  NoteTimeline,
  type TimelineClock,
} from '@/features/timeline/components/note-timeline';

import { useScoredAttempt } from '../hooks/use-scored-attempt';
import {
  type ScoringControls,
  type ScoringLoop,
  useScoring,
} from '../hooks/use-scoring';
import { useSingVoice } from '../hooks/use-sing-voice';
import type { PlaybackSource } from '../mic-controller';
import { useScoringSettings } from '../stores/scoring-settings';
import { foldReference, foldVoiceOctave } from '../voice-octave';
import { ScoreFeedback } from './score-feedback';
import { SingReadout } from './sing-readout';

/**
 * The note timeline that follows the mic: in listen mode it is the plain
 * timeline; with the mic on it is drawn in sing mode (labeled lanes and the
 * user's voice line) and the target and detected notes are written above it.
 *
 * A finished run is reported once through `onAttempt` (the Track page above
 * decides what it means: submit it signed in, keep it waiting as a visitor),
 * and the result sheet shows whatever `renderAttemptStatus` draws for the
 * current difficulty. The transposition and the speed arrive as plain values
 * because they live on the Track page, not in this feature.
 */
export function SingTimeline({
  notes,
  playback,
  controls,
  loop,
  transpose,
  rate,
  onAttempt,
  renderAttemptStatus,
  ...timeline
}: {
  notes: readonly TrackNote[];
  playback: PlaybackSource & {
    getState(): { status: string; time: number; rate?: number };
  };
  controls?: ScoringControls | null;
  loop?: ScoringLoop;
  transpose: number;
  rate: number;
  onAttempt: (body: SubmitPracticeAttemptBody) => void;
  renderAttemptStatus?: () => ReactNode;
  label: string;
  clock?: TimelineClock;
  onScrub?: (seconds: number) => void;
  className?: string;
}) {
  const voice = useSingVoice(playback);
  const scoring = useScoring({ notes, playback, controls, loop });
  useScoredAttempt({ notes, scoring, transpose, rate, onAttempt });
  const octaveMode = useScoringSettings((state) => state.octaveMode);
  const source = useMemo(() => {
    if (!voice) return undefined;
    // "Any octave" judges pitch class, so the line folds by whole octaves
    // onto the notes: a comfortable lower octave draws where it is judged.
    const fold = octaveMode === 'ANY';
    return {
      ...voice,
      segments: (from: number, to: number) => {
        const stretches = voice.segments(from, to);
        if (!fold) return stretches;
        return stretches.map((segment) =>
          segment.map((point) => {
            const reference = foldReference(notes, point.time);
            return reference === null
              ? point
              : { ...point, midi: foldVoiceOctave(point.midi, reference) };
          }),
        );
      },
      judgment: (note: TrackNote) =>
        scoring.session.getSnapshot().judgments[notes.indexOf(note)] ?? null,
      subscribe(listener: () => void) {
        const stopVoice = voice.subscribe(listener);
        const stopScore = scoring.session.subscribe(listener);
        return () => {
          stopVoice();
          stopScore();
        };
      },
    };
  }, [voice, scoring.session, notes, octaveMode]);

  return (
    <div className="flex flex-col gap-2">
      {voice ? <SingReadout notes={notes} playback={playback} /> : null}
      <ScoreFeedback
        scoring={scoring}
        renderAttemptStatus={renderAttemptStatus}
      />
      <NoteTimeline notes={notes} voice={source} {...timeline} />
    </div>
  );
}
