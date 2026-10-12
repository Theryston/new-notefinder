'use client';

import type { TrackNote } from '@notefinder/contracts';
import { useEffect, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';

import {
  drawListenTimeline,
  type TimelineColors,
} from '../draw-listen-timeline';
import { laneRangeOf } from '../timeline-geometry';

/** The Track rests at its start until playback exists. */
const RESTING_TIME = 0;

/** Reads the design tokens the roll draws with from the element's theme. */
function readColors(element: HTMLElement): TimelineColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    lane: token('--timeline-lane'),
    surface: token('--surface'),
    border: token('--border'),
    key: token('--timeline-key'),
    keySharp: token('--timeline-key-sharp'),
    keyLabel: token('--muted-foreground'),
    note: token('--timeline-note'),
    notePast: token('--timeline-note-past'),
    noteLabel: token('--primary-foreground'),
    playhead: token('--foreground'),
    fontFamily: token('--font-mono') || 'monospace',
  };
}

/**
 * The note timeline in listen mode (DESIGN.md "Note timeline"), drawn on a
 * canvas that fills its box: a piano roll fitted to the Track's range with the
 * Track resting at its start. It redraws when the box resizes and when the
 * theme changes, with the colors read again from the tokens. `label` names the
 * canvas for assistive tech, since its content is not text.
 */
export function NoteTimeline({
  notes,
  label,
  className,
}: {
  notes: readonly TrackNote[];
  label: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const range = useMemo(() => laneRangeOf(notes), [notes]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!box || !canvas || !ctx) return;

    const draw = () => {
      const { width, height } = box.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawListenTimeline(ctx, {
        width,
        height,
        notes,
        range,
        now: RESTING_TIME,
        colors: readColors(box),
      });
    };

    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(box);
    // next-themes switches the theme with a class on <html>.
    const theme = new MutationObserver(draw);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => {
      resize.disconnect();
      theme.disconnect();
    };
  }, [notes, range]);

  return (
    <div
      ref={boxRef}
      className={cn(
        'h-56 w-full overflow-hidden rounded-2xl border bg-card md:h-72',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="block size-full"
      />
    </div>
  );
}
