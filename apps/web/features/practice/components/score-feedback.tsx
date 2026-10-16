'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { useScoring } from '../hooks/use-scoring';
import { useMicState } from '../stores/mic-store';

const ScoreResult = dynamic(
  () => import('./score-result').then((module) => module.ScoreResult),
  { ssr: false },
);

/** The rows above the timeline can wrap in narrow viewports and in
 * translated interfaces. Measures every visible row above the timeline (the
 * sung-note readout and this score row) so the timeline shrinks by both. The
 * readout is `display: none` in fullscreen, so its zero height drops it from
 * the sum there automatically. */
function useScoreRowHeight(visible: boolean) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const container = row?.parentElement;
    if (!visible || !row || !container) return;
    const box = container as HTMLElement;
    const watched = new Set<Element>();
    const resize = new ResizeObserver(measure);
    function watch(element: Element) {
      if (!watched.has(element)) {
        watched.add(element);
        resize.observe(element);
      }
    }
    function measure() {
      const gap = Number.parseFloat(getComputedStyle(box).rowGap) || 0;
      const timeline = box.lastElementChild;
      let total = 0;
      for (const child of Array.from(box.children)) {
        if (child === timeline) break;
        watch(child);
        const height = (child as HTMLElement).getBoundingClientRect().height;
        if (height > 0) total += height + gap;
      }
      box.style.setProperty('--score-feedback-height', `${total}px`);
    }
    // The sung-note readout mounts once the voice stream arrives, after this
    // effect runs: watching the container re-measures when rows are added,
    // removed, or resized (wrapping), and the childList observer picks up
    // rows added later so their own resizes are followed too.
    resize.observe(box);
    const mutations = new MutationObserver(measure);
    mutations.observe(box, { childList: true });
    measure();
    return () => {
      mutations.disconnect();
      resize.disconnect();
      box.style.removeProperty('--score-feedback-height');
    };
  }, [visible]);
  return rowRef;
}

export function ScoreFeedback({
  scoring,
}: {
  scoring: ReturnType<typeof useScoring>;
}) {
  const t = useTranslations('practice.scoring');
  const micOn = useMicState((state) => state.status === 'on');
  const rowRef = useScoreRowHeight(micOn);
  const { summary, latest, result } = scoring.snapshot;
  return (
    <>
      {micOn && (
        <div
          ref={rowRef}
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <p role="status" data-testid="score-readout">
            {latest ? `${t(latest)} · ` : null}
            {t(summary.loop ? 'sectionScore' : 'liveScore', {
              percent: Math.round(summary.accuracy * 100),
              count: summary.judged,
            })}
          </p>
          <Button variant="outline" onClick={scoring.stop}>
            {t('stop')}
          </Button>
        </div>
      )}
      {result !== null && <ScoreResult scoring={scoring} />}
    </>
  );
}
