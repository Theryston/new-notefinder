import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeScript = { src: string; async: boolean; onerror: (() => void) | null };

let scripts: FakeScript[];
let fakeWindow: {
  YT?: { Player: unknown };
  onYouTubeIframeAPIReady?: () => void;
};

beforeEach(() => {
  vi.resetModules();
  scripts = [];
  fakeWindow = {};
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('document', {
    createElement: () => {
      const script: FakeScript = { src: '', async: false, onerror: null };
      scripts.push(script);
      return script;
    },
    head: { append: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fresh copy of the module, so its one-time loading state starts empty. */
async function freshLoader() {
  const { loadYouTubeApi } = await import('./youtube-api');
  return loadYouTubeApi;
}

describe('loadYouTubeApi', () => {
  it('resolves at once when the API is already on the page', async () => {
    const api = { Player: class {} };
    fakeWindow.YT = api;

    const load = await freshLoader();

    await expect(load()).resolves.toBe(api);
    expect(scripts).toHaveLength(0);
  });

  it('adds the IFrame API script once and resolves when YouTube is ready', async () => {
    const load = await freshLoader();
    const first = load();
    const second = load();
    const api = { Player: class {} };
    fakeWindow.YT = api;

    fakeWindow.onYouTubeIframeAPIReady?.();

    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe('https://www.youtube.com/iframe_api');
  });

  it('rejects when the script fails to load, and tries again next time', async () => {
    const load = await freshLoader();
    const failed = load();

    scripts[0]?.onerror?.();

    await expect(failed).rejects.toThrow('failed to load');
    const retry = load();
    expect(scripts).toHaveLength(2);
    fakeWindow.YT = { Player: class {} };
    fakeWindow.onYouTubeIframeAPIReady?.();
    await expect(retry).resolves.toBeDefined();
  });

  it('keeps a callback another script already set', async () => {
    const earlier = vi.fn();
    fakeWindow.onYouTubeIframeAPIReady = earlier;
    const load = await freshLoader();
    const pending = load();
    fakeWindow.YT = { Player: class {} };

    fakeWindow.onYouTubeIframeAPIReady?.();
    await pending;

    expect(earlier).toHaveBeenCalledOnce();
  });
});
