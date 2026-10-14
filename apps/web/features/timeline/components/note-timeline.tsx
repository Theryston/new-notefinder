'use client';

import type { TrackNote } from '@notefinder/contracts';
import { type PointerEvent, useEffect, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';

import {
  drawListenTimeline,
  type TimelineColors,
} from '../draw-listen-timeline';
import {
  drawSingTimeline,
  type SingTimelineColors,
  type VoiceSource,
} from '../draw-sing-timeline';
import { type LaneRange, laneRangeOf, scrubTime } from '../timeline-geometry';

/**
 * Where the roll gets the moment of the Track to draw, and when it changes.
 * It is read and subscribed to outside React, so a moving playhead never
 * re-renders anything. Without one the Track rests at its start.
 */
export type TimelineClock = {
  now(): number;
  subscribe(listener: () => void): () => void;
};

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

/** The extra tokens sing mode draws with (DESIGN.md "Sing mode"). */
function readSingColors(
  element: HTMLElement,
  colors: TimelineColors,
): SingTimelineColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    ...colors,
    muted: token('--muted'),
    mutedLine: token('--muted-foreground'),
    mutedLabel: token('--muted-foreground'),
    current: token('--primary'),
    voice: token('--timeline-pitch'),
  };
}

type Measured = {
  width: number;
  height: number;
  colors: SingTimelineColors;
};

/** Sizes the canvas to its box (at device pixels) and reads the colors. */
function measure(box: HTMLElement, canvas: HTMLCanvasElement): Measured {
  const { width, height } = box.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.setTransform(scale, 0, 0, scale, 0, 0);
  return {
    width,
    height,
    colors: readSingColors(box, readColors(box)),
  };
}

type Painting = {
  notes: readonly TrackNote[];
  range: LaneRange;
  clock: TimelineClock | undefined;
  /** Present while the mic is on: the roll is drawn in sing mode. */
  voice: VoiceSource | undefined;
};

/**
 * Keeps the canvas drawn: the size and colors are measured again when the box
 * resizes or the theme changes, and a frame is drawn whenever the clock moves.
 */
function useTimelinePainting(
  boxRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  { notes, range, clock, voice }: Painting,
) {
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!box || !canvas || !ctx) return;

    let measured = measure(box, canvas);
    let drawnAt = Number.NaN;
    const paint = () => {
      drawnAt = clock?.now() ?? 0;
      const frame = { ...measured, notes, range, now: drawnAt };
      if (voice) drawSingTimeline(ctx, { ...frame, voice });
      else drawListenTimeline(ctx, frame);
    };
    const remeasure = () => {
      measured = measure(box, canvas);
      paint();
    };

    paint();
    const resize = new ResizeObserver(remeasure);
    resize.observe(box);
    // next-themes switches the theme with a class on <html>.
    const theme = new MutationObserver(remeasure);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    const unsubscribe = clock?.subscribe(() => {
      if (clock.now() !== drawnAt) paint();
    });
    // The voice moves the line even while the Track rests (paused).
    const unsubscribeVoice = voice?.subscribe(paint);
    return () => {
      resize.disconnect();
      theme.disconnect();
      unsubscribe?.();
      unsubscribeVoice?.();
    };
  }, [boxRef, canvasRef, notes, range, clock, voice]);
}

type Drag = { startX: number; startTime: number };

/** Dragging the roll sideways seeks: it follows the pointer like a record. */
function useScrub(
  clock: TimelineClock | undefined,
  onScrub: ((seconds: number) => void) | undefined,
) {
  const drag = useRef<Drag | null>(null);
  if (!clock || !onScrub) return {};
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startX: event.clientX, startTime: clock.now() };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!drag.current) return;
      const dx = event.clientX - drag.current.startX;
      onScrub(scrubTime(drag.current.startTime, dx));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  };
}

/**
 * The note timeline in listen mode (DESIGN.md "Note timeline"), drawn on a
 * canvas that fills its box: a piano roll fitted to the Track's range. With a
 * `clock` it follows playback and can be dragged to seek (`onScrub`); without
 * one the Track rests at its start. With a `voice` (the mic is on) it draws in
 * sing mode instead: labeled lanes and the user's voice line. `label` names the canvas for assistive
 * tech, since its content is not text.
 */
export function NoteTimeline({
  notes,
  label,
  clock,
  onScrub,
  voice,
  className,
}: {
  notes: readonly TrackNote[];
  label: string;
  clock?: TimelineClock;
  onScrub?: (seconds: number) => void;
  /** The user's voice; giving one switches the roll to sing mode. */
  voice?: VoiceSource;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const range = useMemo(() => laneRangeOf(notes), [notes]);
  useTimelinePainting(boxRef, canvasRef, { notes, range, clock, voice });
  const scrub = useScrub(clock, onScrub);

  return (
    <div
      ref={boxRef}
      {...scrub}
      className={cn(
        'h-56 w-full overflow-hidden rounded-2xl border bg-card md:h-72',
        // Sideways drags seek; vertical ones still scroll the page on a phone.
        onScrub && 'cursor-grab touch-pan-y select-none active:cursor-grabbing',
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
