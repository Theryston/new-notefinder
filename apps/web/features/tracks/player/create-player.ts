import type { TrackAudio } from '@notefinder/contracts';
import type { PlayerPort } from './player-port';

export type CreatePlayerOptions = {
  /** The element the video is mounted into. */
  host: HTMLElement;
  /** The Track's length in seconds, for the fake player's pretend video. */
  durationSeconds: number;
  /** The e2e build's env flag: a clock instead of YouTube. */
  fake: boolean;
  directAudio?: TrackAudio;
};

/**
 * Picks the player: YouTube for everyone, the fake one in e2e builds. Both
 * implementations are dynamic imports, so neither is in first-load JS.
 */
export async function createPlayer({
  host,
  durationSeconds,
  fake,
  directAudio,
}: CreatePlayerOptions): Promise<PlayerPort> {
  if (fake) {
    const { FakePlayer } = await import('./fake-player');
    const player = new FakePlayer({ durationSeconds });
    const peaks = [0.1, 0.4, 0.8, 1, 0.6, 0.3, 0.9, 0.5];
    if (directAudio)
      return Object.assign(player, {
        waveform: () => peaks,
        setTranspose: (_semitones: number) => {},
        setVocalsOnly: (_vocals: boolean) => {},
      });
    return player;
  }
  if (directAudio) {
    const { DirectAudioPlayer } = await import('./direct-audio-player');
    return new DirectAudioPlayer(directAudio);
  }
  const [{ YouTubePlayer }, { loadYouTubeApi }] = await Promise.all([
    import('./youtube-player'),
    import('./youtube-api'),
  ]);
  return new YouTubePlayer(host, await loadYouTubeApi());
}
