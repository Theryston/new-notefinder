import { TrackPracticeSkeleton } from '@/features/tracks/components/track-practice-view';

/** Practice-shaped skeleton while the Track's state streams in: completed is
 * the common case, so loading already looks like practice (a still-loading
 * Processing run is the exception, and its own view replaces this). */
export default function TrackLoading() {
  return <TrackPracticeSkeleton />;
}
