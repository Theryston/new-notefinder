import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissMicNotice, stopMic, toggleMic } from './mic-controller';
import type { OnReading } from './mic-session';
import { initialMicState, micStore } from './stores/mic-store';
import { voiceTrail } from './voice-trail';

const sessions = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('./mic-session', () => ({ startMicSession: sessions.start }));

function playbackAt(status: string, time: number) {
  return { getState: () => ({ status, time }), subscribe: () => () => {} };
}

/** A page whose tab can be hidden and which can be left. */
function stubPage() {
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
  });
  const window = new EventTarget();
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  return {
    hide: () => {
      document.visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    },
    leave: () => window.dispatchEvent(new Event('pagehide')),
  };
}

/** Starts the mic and hands back the callback the session reports through. */
async function startAndCapture(status: string, time: number) {
  let report: OnReading = () => {};
  sessions.start.mockImplementation((onReading: OnReading) => {
    report = onReading;
    return Promise.resolve({ stop: sessions.stop });
  });
  await toggleMic(playbackAt(status, time));
  return (midi: number | null, lag: number) => report(midi, lag);
}

describe('the mic controller', () => {
  let page: ReturnType<typeof stubPage>;

  beforeEach(() => {
    page = stubPage();
    micStore.setState(initialMicState);
    voiceTrail.clear();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
    });
  });

  it('turns the mic on and off', async () => {
    sessions.start.mockResolvedValue({ stop: sessions.stop });
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState().status).toBe('on');

    await toggleMic(playbackAt('paused', 0));
    expect(sessions.stop).toHaveBeenCalledOnce();
    expect(micStore.getState().status).toBe('off');
  });

  it('does not start twice while it is starting', async () => {
    sessions.start.mockImplementation(() => new Promise(() => {}));
    const playback = playbackAt('paused', 0);
    void toggleMic(playback);
    await vi.waitFor(() => expect(sessions.start).toHaveBeenCalled());
    await toggleMic(playback);
    expect(sessions.start).toHaveBeenCalledOnce();
    expect(micStore.getState().status).toBe('starting');
  });

  it('leaves a refusal for the dock to explain', async () => {
    sessions.start.mockRejectedValue({ name: 'NotAllowedError' });
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState()).toEqual({ status: 'off', notice: 'denied' });
  });

  it('says a missing mic is unavailable', async () => {
    sessions.start.mockRejectedValue(new Error('no device'));
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState().notice).toBe('unavailable');
  });

  it('forgets the old notice on the next try', async () => {
    sessions.start.mockRejectedValueOnce({ name: 'NotAllowedError' });
    sessions.start.mockResolvedValueOnce({ stop: sessions.stop });
    await toggleMic(playbackAt('paused', 0));
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState().status).toBe('on');
    expect(micStore.getState().notice).not.toBe('denied');
  });

  it('recommends headphones the first time the mic is on', async () => {
    sessions.start.mockResolvedValue({ stop: sessions.stop });
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState().notice).toBe('headphones');
    dismissMicNotice();
    expect(micStore.getState().notice).toBeNull();
  });

  it('places the voice on the Track, earlier by the latency, while playing', async () => {
    const report = await startAndCapture('playing', 10);
    report(62, 0.1);
    report(63, 0.1);
    expect(voiceTrail.segments(0, 20)).toEqual([
      [
        { time: 9.9, midi: 62 },
        { time: 9.9, midi: 63 },
      ],
    ]);
  });

  it('only feeds the readout while paused', async () => {
    const report = await startAndCapture('paused', 10);
    report(62, 0.1);
    expect(voiceTrail.segments(0, 20)).toEqual([]);
    expect(voiceTrail.latest()).toBe(62);
  });

  it('clears the voice when the mic goes off', async () => {
    sessions.start.mockResolvedValue({ stop: sessions.stop });
    await toggleMic(playbackAt('playing', 10));
    voiceTrail.push(10, 60);
    stopMic();
    expect(voiceTrail.segments(0, 20)).toEqual([]);
  });

  it('forgets a notice when the mic is stopped, so the next Track starts clean', async () => {
    sessions.start.mockRejectedValue({ name: 'NotAllowedError' });
    await toggleMic(playbackAt('paused', 0));
    stopMic();
    expect(micStore.getState().notice).toBeNull();
  });

  describe('leaving while the mic is still starting', () => {
    it('stops the session that arrives late instead of leaving it recording', async () => {
      let finish: (session: { stop: () => void }) => void = () => {};
      sessions.start.mockImplementation(
        () => new Promise((resolve) => (finish = resolve)),
      );
      void toggleMic(playbackAt('paused', 0));
      await vi.waitFor(() => expect(sessions.start).toHaveBeenCalled());

      stopMic();
      finish({ stop: sessions.stop });

      await vi.waitFor(() => expect(sessions.stop).toHaveBeenCalledOnce());
      expect(micStore.getState()).toEqual(initialMicState);
    });

    it('does not show an error that arrives late', async () => {
      let fail: (error: unknown) => void = () => {};
      sessions.start.mockImplementation(
        () => new Promise((_resolve, reject) => (fail = reject)),
      );
      void toggleMic(playbackAt('paused', 0));
      await vi.waitFor(() => expect(sessions.start).toHaveBeenCalled());

      stopMic();
      fail({ name: 'NotAllowedError' });
      await Promise.resolve();
      await Promise.resolve();

      expect(micStore.getState()).toEqual(initialMicState);
    });

    it('lets a new start work after the cancelled one', async () => {
      let finish: (session: { stop: () => void }) => void = () => {};
      sessions.start.mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve)),
      );
      sessions.start.mockResolvedValueOnce({ stop: sessions.stop });
      void toggleMic(playbackAt('paused', 0));
      await vi.waitFor(() => expect(sessions.start).toHaveBeenCalled());
      stopMic();

      await toggleMic(playbackAt('paused', 0));
      expect(micStore.getState().status).toBe('on');
      finish({ stop: vi.fn() });
      await Promise.resolve();
      expect(micStore.getState().status).toBe('on');
    });
  });

  describe('when the page goes away', () => {
    it('releases the mic when the tab is hidden', async () => {
      sessions.start.mockResolvedValue({ stop: sessions.stop });
      await toggleMic(playbackAt('playing', 0));
      page.hide();
      expect(sessions.stop).toHaveBeenCalledOnce();
      expect(micStore.getState().status).toBe('off');
    });

    it('releases the mic on pagehide', async () => {
      sessions.start.mockResolvedValue({ stop: sessions.stop });
      await toggleMic(playbackAt('playing', 0));
      page.leave();
      expect(sessions.stop).toHaveBeenCalledOnce();
    });

    it('keeps the mic when the tab becomes visible again', async () => {
      sessions.start.mockResolvedValue({ stop: sessions.stop });
      await toggleMic(playbackAt('playing', 0));
      page.hide();
      sessions.stop.mockClear();
      await toggleMic(playbackAt('playing', 0));
      expect(micStore.getState().status).toBe('on');
      expect(sessions.stop).not.toHaveBeenCalled();
    });

    it('stops listening to the page once the mic is off', async () => {
      sessions.start.mockResolvedValue({ stop: sessions.stop });
      await toggleMic(playbackAt('playing', 0));
      stopMic();
      sessions.stop.mockClear();
      page.hide();
      expect(sessions.stop).not.toHaveBeenCalled();
    });
  });
});
