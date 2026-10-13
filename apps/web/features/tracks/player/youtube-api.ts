/**
 * The slice of the YouTube IFrame Player API the page uses. The API ships no
 * types of its own, and `@types/youtube` would add a dependency for a handful
 * of calls.
 */
export const YT_STATE = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export type YouTubePlayerHandle = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
};

export type YouTubePlayerOptions = {
  width: number;
  height: number;
  videoId: string;
  playerVars: Record<string, number | string>;
  events: {
    onReady: () => void;
    onStateChange: (event: { data: number }) => void;
  };
};

export type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: YouTubePlayerOptions,
  ) => YouTubePlayerHandle;
};

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging, to type the globals the IFrame API script defines.
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api';

let loading: Promise<YouTubeApi> | undefined;

/**
 * Loads the IFrame API script once and resolves with its namespace. Called
 * from a dynamic import, so the script costs nothing until a page plays.
 */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('YouTube API missing after load'));
    };
    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      loading = undefined;
      reject(new Error('YouTube API failed to load'));
    };
    document.head.append(script);
  });
  return loading;
}
