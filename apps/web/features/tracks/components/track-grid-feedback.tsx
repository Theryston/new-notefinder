'use client';

import { Button } from '@/components/ui/button';

import { TrackCardGrid } from './track-card-grid';
import { TrackCardSkeleton } from './track-card-skeleton';

/** Twelve placeholders fill the grid at every breakpoint. */
const SKELETON_KEYS = Array.from(
  { length: 12 },
  (_, index) => `skeleton-${index}`,
);

/**
 * Same-dimension placeholders for the track grid while it loads, so the
 * page does not jump. The shared card grid keeps the exact density of the
 * final cards. `label` is the status the assistive tech announces.
 */
export function TrackGridSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <TrackCardGrid>
        {SKELETON_KEYS.map((key) => (
          <TrackCardSkeleton key={key} />
        ))}
      </TrackCardGrid>
    </div>
  );
}

/** Empty track grid: the owner has no processed tracks yet. */
export function TrackGridEmpty({
  messages,
}: {
  messages: { title: string; description: string };
}) {
  return (
    <div className="rounded-2xl border border-border px-4 py-8 text-center">
      <p className="font-semibold">{messages.title}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        {messages.description}
      </p>
    </div>
  );
}

/** Track grid error with a retry, for network or API failures. */
export function TrackGridError({
  messages,
  onRetry,
}: {
  messages: { title: string; description: string; retry: string };
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border px-4 py-8 text-center">
      <p className="font-semibold">{messages.title}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        {messages.description}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={onRetry}
        className="mt-4"
      >
        {messages.retry}
      </Button>
    </div>
  );
}
