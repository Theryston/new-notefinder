import type { TrackSummary } from '@notefinder/contracts';
import type { ReactNode } from 'react';

import { TrackCard } from './track-card';

// Covers in the first row(s) of the widest layout are loaded right away.
const EAGER_COVERS = 6;

/** Shared by the cards and their skeletons, so both lay out the same. */
export function TrackGridFrame({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {children}
    </ul>
  );
}

type TrackGridProps = {
  tracks: TrackSummary[];
  /** The first page: its top covers load eagerly. */
  first?: boolean;
};

export function TrackGrid({ tracks, first = false }: TrackGridProps) {
  return (
    <TrackGridFrame>
      {tracks.map((track, index) => (
        <li key={track.id} className="min-w-0">
          <TrackCard track={track} eager={first && index < EAGER_COVERS} />
        </li>
      ))}
    </TrackGridFrame>
  );
}
