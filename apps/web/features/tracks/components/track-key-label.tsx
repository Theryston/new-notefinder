'use client';

import type { TrackKey } from '@notefinder/contracts';

import { useKeyText } from '../hooks/use-key-text';

/** The Track's estimated key (`G major`) in the title row, moved by the transposition. */
export function TrackKeyLabel({ trackKey }: { trackKey: TrackKey }) {
  const text = useKeyText(trackKey);

  return (
    <span className="shrink-0" data-testid="track-key">
      {text}
    </span>
  );
}
