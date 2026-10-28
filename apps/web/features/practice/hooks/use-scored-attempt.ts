'use client';

import type { SubmitPracticeAttemptBody, TrackNote } from '@vozzify/contracts';
import { useEffect, useRef } from 'react';
import {
  buildScoredAttemptBody,
  collectVoiceSample,
  type StampedSample,
  selectRunSamples,
} from '../scored-attempt';
import { scoringSettings } from '../stores/scoring-settings';
import { voiceTrail } from '../voice-trail';
import type { useScoring } from './use-scoring';

/**
 * Reports a finished run once, as the attempt the page saves. Everything
 * cross-feature arrives as plain values (the transposition, the speed) or
 * leaves through the callback, so this stays inside the practice feature:
 * the Track page decides what a report means (submit it signed in, keep it
 * waiting as a visitor). The report itself is pure
 * ({@link buildScoredAttemptBody}); this is the wiring.
 */
export function useScoredAttempt({
  notes,
  scoring,
  transpose,
  rate,
  onAttempt,
}: {
  notes: readonly TrackNote[];
  scoring: ReturnType<typeof useScoring>;
  transpose: number;
  rate: number;
  onAttempt: (body: SubmitPracticeAttemptBody) => void;
}) {
  // Every run on this page shares one collection; the report below scopes
  // it to the run that just finished, so an earlier run cannot mark this one.
  const samples = useRef<StampedSample[]>([]);
  // The last result seen: only a fresh finish reports.
  const previous = useRef<unknown>(null);
  const report = useRef(onAttempt);
  report.current = onAttempt;

  useEffect(
    () =>
      voiceTrail.subscribe((reading) => {
        collectVoiceSample(samples.current, reading);
      }),
    [],
  );

  const result = scoring.snapshot.result;
  useEffect(() => {
    const window = scoring.session.runWindow();
    const body = buildScoredAttemptBody({
      result,
      previous: previous.current,
      settings: scoringSettings.getState(),
      transpose,
      rate,
      samples: selectRunSamples(samples.current, window),
      notes,
      window,
    });
    previous.current = result;
    if (body) report.current(body);
  }, [result, notes, transpose, rate, scoring.session]);
}
