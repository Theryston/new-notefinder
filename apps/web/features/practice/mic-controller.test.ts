import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stopMic, toggleMic } from './mic-controller';
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
  beforeEach(() => {
    micStore.setState(initialMicState);
    voiceTrail.clear();
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
    expect(micStore.getState()).toEqual({ status: 'off', problem: 'denied' });
  });

  it('says a missing mic is unavailable', async () => {
    sessions.start.mockRejectedValue(new Error('no device'));
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState().problem).toBe('unavailable');
  });

  it('forgets the old problem on the next try', async () => {
    sessions.start.mockRejectedValueOnce({ name: 'NotAllowedError' });
    sessions.start.mockResolvedValueOnce({ stop: sessions.stop });
    await toggleMic(playbackAt('paused', 0));
    await toggleMic(playbackAt('paused', 0));
    expect(micStore.getState()).toEqual({ status: 'on', problem: null });
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
});
