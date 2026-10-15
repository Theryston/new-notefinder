import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(
  'tone',
  async () => (await import('../../../e2e/direct-audio-fixture')).toneModule,
);

import { Media, settle, tone, urls } from '../../../e2e/direct-audio-fixture';
import { DirectAudioPlayer } from './direct-audio-player';

describe('DirectAudioPlayer', () => {
  let audio: Media;
  let player: DirectAudioPlayer;
  const states = vi.fn();
  const fetchAudio = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    tone.start.mockResolvedValue(undefined);
    audio = new Media();
    vi.stubGlobal(
      'Audio',
      class extends Media {
        constructor() {
          super();
          audio = this;
        }
      },
    );
    fetchAudio.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
    });
    vi.stubGlobal('fetch', fetchAudio);
    tone.decode.mockResolvedValue({
      duration: 120,
      getChannelData: () => new Float32Array([0, -0.5, 1]),
    });
    player = new DirectAudioPlayer(urls);
    player.onState(states);
  });
  afterEach(() => {
    player.destroy();
    vi.unstubAllGlobals();
  });

  it('decodes real amplitudes and announces readiness after media metadata', async () => {
    expect(player.isReady()).toBe(false);
    player.play();
    expect(tone.start).not.toHaveBeenCalled();
    await player.load();
    expect(player.isReady()).toBe(true);
    expect(player.duration()).toBe(120);
    expect(player.waveform()).toEqual([0, 0.5, 1]);
    expect(audio.src).toBe(urls.musicMp3Url);
    expect(audio.crossOrigin).toBe('anonymous');
    expect(audio.preservesPitch).toBe(false);
    expect(states).toHaveBeenLastCalledWith('ready');
  });

  it('plays, seeks, pauses, mutes and reports the end', async () => {
    await player.load();
    player.play();
    await settle();
    expect(states).toHaveBeenLastCalledWith('playing');
    player.seek(22);
    expect(player.currentTime()).toBe(22);
    player.setMuted(true);
    expect(audio.muted).toBe(true);
    player.pause();
    expect(states).toHaveBeenLastCalledWith('paused');
    audio.onended?.();
    expect(states).toHaveBeenLastCalledWith('ended');
    audio.duration = Number.NaN;
    expect(player.duration()).toBe(0);
  });

  it('compensates speed without changing the requested transposition', () => {
    player.setTranspose(4);
    expect(tone.effect.pitch).toBe(4);
    player.setRate(0.5);
    expect(audio.playbackRate).toBe(0.5);
    expect(tone.effect.pitch).toBe(16);
    player.setTranspose(-2);
    expect(tone.effect.pitch).toBe(10);
  });

  it('switches vocals in place, preserving time, rate and playback and caching decoded sources', async () => {
    await player.load();
    player.seek(32);
    player.setRate(0.75);
    player.play();
    await settle();
    player.setVocalsOnly(true);
    await settle();
    expect(audio.src).toBe(urls.vocalsMp3Url);
    expect(player.currentTime()).toBe(32);
    expect(audio.playbackRate).toBe(0.75);
    expect(states).toHaveBeenLastCalledWith('playing');
    player.pause();
    player.setVocalsOnly(false);
    await settle();
    expect(audio.src).toBe(urls.musicMp3Url);
    expect(audio.paused).toBe(true);
    expect(fetchAudio).toHaveBeenCalledTimes(2);
  });

  it('reports download and playback failures without unhandled rejections', async () => {
    fetchAudio.mockResolvedValueOnce({ ok: false });
    await expect(player.load()).rejects.toThrow('Audio download failed');
    await player.load();
    tone.start.mockRejectedValueOnce(new Error('blocked'));
    player.play();
    await settle();
    expect(states).toHaveBeenLastCalledWith('error');
    fetchAudio.mockRejectedValueOnce(new Error('offline'));
    player.setVocalsOnly(true);
    await settle();
    expect(states).toHaveBeenLastCalledWith('error');
  });

  it('ignores a decoded source that arrives after disposal', async () => {
    let finish: ((response: unknown) => void) | undefined;
    fetchAudio.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const loading = player.load();
    player.destroy();
    finish?.({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
    await loading;
    expect(audio.src).toBe('');
    expect(states).not.toHaveBeenCalled();
    expect(tone.disconnect).toHaveBeenCalled();
    expect(tone.dispose).toHaveBeenCalled();
  });
});
