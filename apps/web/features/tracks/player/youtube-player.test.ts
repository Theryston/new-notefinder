import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { PlaybackController } from '../playback/playback-controller';
import {
  initialPlaybackState,
  type PlaybackState,
} from '../stores/playback-store';
import { type PlayerState, YOUTUBE_SQUARE_PX } from './player-port';
import {
  type YouTubeApi,
  type YouTubePlayerOptions,
  YT_STATE,
} from './youtube-api';
import { YouTubePlayer } from './youtube-player';

/**
 * A YouTube API whose player the test drives by hand. Like the real one, the
 * object `new YT.Player()` returns has NO methods until just before `onReady`
 * fires, so a call made earlier throws "is not a function".
 */
function setUp() {
  let options: YouTubePlayerOptions | undefined;
  let instance: object | undefined;
  const methods = {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 212),
    setPlaybackRate: vi.fn(),
    mute: vi.fn(),
    unMute: vi.fn(),
    destroy: vi.fn(),
  };
  const handle = methods;
  const mount = { remove: vi.fn() };
  const host = {
    ownerDocument: { createElement: vi.fn(() => mount) },
    append: vi.fn(),
    replaceChildren: vi.fn(),
  };
  const api: YouTubeApi = {
    Player: class {
      constructor(_element: HTMLElement, given: YouTubePlayerOptions) {
        options = given;
        instance = this;
      }
    } as unknown as YouTubeApi['Player'],
  };
  let clock = 0;
  const player = new YouTubePlayer(
    // The player only creates and appends one child of the host.
    host as unknown as HTMLElement,
    api,
    () => clock,
  );
  const states: PlayerState[] = [];
  player.onState((state) => states.push(state));
  const loaded = player.load('abc123');
  const events = () => {
    if (!options) throw new Error('the player was not created');
    const given = options.events;
    return {
      ...given,
      // The API installs the methods, then tells the page it is ready.
      onReady: () => {
        Object.assign(instance ?? {}, methods);
        given.onReady();
      },
    };
  };
  return {
    player,
    handle,
    mount,
    host,
    states,
    loaded,
    events,
    /** Brings the player to the state YouTube calls ready. */
    ready: () => events().onReady(),
    options: () => options,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('YouTubePlayer', () => {
  it('mounts a small square without YouTube controls', () => {
    const { options, host } = setUp();

    expect(host.append).toHaveBeenCalledOnce();
    expect(options()).toMatchObject({
      width: YOUTUBE_SQUARE_PX,
      height: YOUTUBE_SQUARE_PX,
      videoId: 'abc123',
      playerVars: { controls: 0, playsinline: 1 },
    });
  });

  it('is ready, and loaded, when YouTube says so', async () => {
    const { player, events, loaded, states } = setUp();
    expect(player.isReady()).toBe(false);

    events().onReady();
    await loaded;

    expect(player.isReady()).toBe(true);
    expect(states).toEqual(['ready']);
    expect(player.duration()).toBe(212);
  });

  it('reports playing, paused and ended, and ignores buffering', () => {
    const { events, states, ready } = setUp();
    ready();
    states.length = 0;

    for (const data of [
      YT_STATE.buffering,
      YT_STATE.playing,
      YT_STATE.paused,
      YT_STATE.cued,
      YT_STATE.ended,
    ]) {
      events().onStateChange({ data });
    }

    expect(states).toEqual(['playing', 'paused', 'ended']);
  });

  it('passes play, pause, rate and mute to YouTube', () => {
    const { player, handle, ready } = setUp();
    ready();

    player.play();
    player.pause();
    player.setRate(1.25);
    player.setMuted(true);
    player.setMuted(false);

    expect(handle.playVideo).toHaveBeenCalledOnce();
    expect(handle.pauseVideo).toHaveBeenCalledOnce();
    expect(handle.setPlaybackRate).toHaveBeenCalledWith(1.25);
    expect(handle.mute).toHaveBeenCalledOnce();
    expect(handle.unMute).toHaveBeenCalledOnce();
  });

  it('moves smoothly between YouTube time reports while playing', () => {
    const { player, handle, events, advance, ready } = setUp();
    ready();
    handle.getCurrentTime.mockReturnValue(10);
    events().onStateChange({ data: YT_STATE.playing });
    player.currentTime();

    advance(200);

    expect(player.currentTime()).toBeCloseTo(10.2, 5);
  });

  it('holds still while paused', () => {
    const { player, handle, events, advance, ready } = setUp();
    ready();
    handle.getCurrentTime.mockReturnValue(10);
    events().onStateChange({ data: YT_STATE.paused });
    player.currentTime();

    advance(2000);

    expect(player.currentTime()).toBe(10);
  });

  it('seeks through YouTube and runs from the target at once', () => {
    const { player, handle, events, advance, ready } = setUp();
    ready();
    handle.getCurrentTime.mockReturnValue(10);
    events().onStateChange({ data: YT_STATE.playing });
    player.currentTime();

    player.seek(90);
    handle.getCurrentTime.mockReturnValue(90);
    advance(100);

    expect(handle.seekTo).toHaveBeenCalledWith(90, true);
    expect(player.currentTime()).toBeCloseTo(90.1, 5);
  });

  it('does not jump back while YouTube still reports the time before a seek', () => {
    const { player, handle, events, advance, ready } = setUp();
    ready();
    handle.getCurrentTime.mockReturnValue(30);
    events().onStateChange({ data: YT_STATE.playing });
    player.currentTime();

    player.seek(90);
    const reads: number[] = [];
    for (let step = 0; step < 4; step += 1) {
      advance(100);
      // getCurrentTime() still answers 30 right after seekTo(90).
      reads.push(player.currentTime());
    }

    for (const read of reads) expect(read).toBeGreaterThanOrEqual(90);
  });

  it('reports an error when YouTube cannot play the video', () => {
    const { events, states } = setUp();

    events().onError({ data: 150 });

    expect(states).toEqual(['error']);
  });

  it('is at the start, and silent, before it loads', () => {
    const player = new YouTubePlayer(
      {} as unknown as HTMLElement,
      {} as unknown as YouTubeApi,
    );

    expect(player.currentTime()).toBe(0);
    expect(player.duration()).toBe(0);
    expect(() => {
      player.play();
      player.pause();
      player.seek(3);
      player.setRate(1);
      player.setMuted(true);
    }).not.toThrow();
  });

  it('removes its iframe when destroyed', () => {
    const { player, handle, mount, ready } = setUp();
    ready();

    player.destroy();

    expect(handle.destroy).toHaveBeenCalledOnce();
    expect(mount.remove).toHaveBeenCalledOnce();
  });

  describe('before YouTube says the player is ready', () => {
    it('answers every call without touching the handle, which has no methods yet', () => {
      const { player } = setUp();

      expect(() => {
        player.play();
        player.pause();
        player.seek(12);
        player.setRate(1.5);
        player.setMuted(true);
      }).not.toThrow();
      expect(player.duration()).toBe(0);
      expect(player.currentTime()).toBe(12);
    });

    it('applies the speed, the mute and the seek set before ready once it is', () => {
      const { player, handle, ready, advance } = setUp();
      player.setRate(1.5);
      player.setMuted(true);
      player.seek(40);
      advance(50);

      ready();

      expect(handle.setPlaybackRate).toHaveBeenCalledWith(1.5);
      expect(handle.mute).toHaveBeenCalledOnce();
      expect(handle.seekTo).toHaveBeenCalledWith(40, true);
    });

    it('does not mute or seek on ready when nothing was set', () => {
      const { handle, ready } = setUp();

      ready();

      expect(handle.mute).not.toHaveBeenCalled();
      expect(handle.setPlaybackRate).not.toHaveBeenCalled();
      expect(handle.seekTo).not.toHaveBeenCalled();
    });

    it('lets the controller take a late Track length before the player is ready', () => {
      // The page does this as soon as the controller exists: the header's
      // length can arrive while YouTube is still loading.
      const { player } = setUp();
      const store = createStore<PlaybackState>(() => initialPlaybackState);
      const controller = new PlaybackController({
        port: player,
        store,
        frames: { request: () => 1, cancel: () => undefined },
        durationHint: 0,
      });

      expect(() => controller.setDurationHint(215)).not.toThrow();
      expect(store.getState().duration).toBe(215);
      expect(() => {
        controller.seek(30);
        controller.setRate(1.25);
        controller.toggleMuted();
        controller.hideVideo();
        controller.dispose();
      }).not.toThrow();
    });

    it('can be destroyed, removing the iframe the handle cannot remove yet', () => {
      const { player, host, handle } = setUp();

      player.destroy();

      expect(handle.destroy).not.toHaveBeenCalled();
      expect(host.replaceChildren).toHaveBeenCalledOnce();
    });

    it('ignores a ready that arrives after it was destroyed', () => {
      const { player, ready, states } = setUp();
      player.destroy();

      ready();

      expect(player.isReady()).toBe(false);
      expect(states).toEqual([]);
    });
  });
});
