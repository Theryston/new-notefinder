import type { PlayerPort } from './player-port';

export type CreatePlayerOptions = {
  /** The element the video is mounted into. */
  host: HTMLElement;
  /** The Track's length in seconds, for the fake player's pretend video. */
  durationSeconds: number;
  /** The e2e build's env flag: a clock instead of YouTube. */
  fake: boolean;
};

/**
 * Picks the player: YouTube for everyone, the fake one in e2e builds. Both
 * implementations are dynamic imports, so neither is in first-load JS.
 */
export async function createPlayer({
  host,
  durationSeconds,
  fake,
}: CreatePlayerOptions): Promise<PlayerPort> {
  if (fake) {
    const { FakePlayer } = await import('./fake-player');
    return new FakePlayer({ durationSeconds });
  }
  const [{ YouTubePlayer }, { loadYouTubeApi }] = await Promise.all([
    import('./youtube-player'),
    import('./youtube-api'),
  ]);
  return new YouTubePlayer(host, await loadYouTubeApi());
}
