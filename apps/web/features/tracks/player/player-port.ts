/** What a player reports about itself; buffering is not one of them. */
export type PlayerState = 'ready' | 'playing' | 'paused' | 'ended';

/**
 * The one interface the practice page plays through. YouTube is the
 * implementation everyone gets; a fake one stands in for it in e2e builds, so
 * the page can be tested without the real IFrame API.
 */
export type PlayerPort = {
  /** Loads the video and resolves once the player can be controlled. */
  load(videoId: string): Promise<void>;
  play(): void;
  pause(): void;
  /** Moves to this moment of the Track, in seconds. */
  seek(seconds: number): void;
  /** The moment being played, in seconds, smooth between the player's reports. */
  currentTime(): number;
  /** The length in seconds, or 0 while the player does not know it. */
  duration(): number;
  setRate(rate: number): void;
  setMuted(muted: boolean): void;
  isReady(): boolean;
  /** Listens to state changes; returns the function that stops listening. */
  onState(listener: (state: PlayerState) => void): () => void;
  destroy(): void;
};

/** Playback speeds the Settings menu offers (spec #160, 0.5x to 1.5x). */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export const DEFAULT_RATE = 1;

/**
 * Side of the YouTube player, in CSS pixels, defined once. It is below
 * YouTube's 200x200 minimum, an accepted risk recorded in #160; raising it
 * to 200 is a change of this number.
 */
export const YOUTUBE_SQUARE_PX = 100;
