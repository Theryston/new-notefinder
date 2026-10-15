import { FlameIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The ring: a track, an arc of today's progress (0 to 1) and a flame inside
 * that fills with the brand color once the day is completed. A visitor's ring
 * is the empty track and a quiet flame.
 */
export function StreakRingGraphic({
  progress,
  completed,
  muted = false,
}: {
  progress: number;
  completed: boolean;
  muted?: boolean;
}) {
  return (
    <span className="relative flex size-10 items-center justify-center">
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="absolute inset-0 size-full -rotate-90"
      >
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          className="stroke-foreground/15"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out-soft"
        />
      </svg>
      <FlameIcon
        aria-hidden="true"
        className={cn(
          'relative size-4',
          muted ? 'text-muted-foreground' : 'text-primary',
          completed && 'animate-pop fill-primary',
        )}
      />
    </span>
  );
}
