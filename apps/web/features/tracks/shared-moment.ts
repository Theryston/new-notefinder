import type { PlaybackStatus } from './stores/playback-store';

/**
 * The moment an old shared link points at (`?time=<seconds>`), or null when
 * the link has none or it is not a usable time. The player clamps a moment
 * past the end of the Track.
 */
export function sharedMomentOf(time: number | null): number | null {
  return time !== null && Number.isFinite(time) && time >= 0 ? time : null;
}

/** The player can be seeked once it has loaded, and never after it failed. */
export function canSeekToSharedMoment(status: PlaybackStatus): boolean {
  return status !== 'loading' && status !== 'error';
}
