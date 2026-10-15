import type { TrackAudio } from '@notefinder/contracts';
import * as Tone from 'tone';

import { BasePlayer } from './base-player';
import type { PlayerPort } from './player-port';
import { compensatedPitch, waveformPeaks } from './waveform';

/** Native media seeks and streams; Tone applies transposition after rate correction. */
export class DirectAudioPlayer extends BasePlayer implements PlayerPort {
  private readonly audio = new Audio();
  private readonly pitch = new Tone.PitchShift().toDestination();
  private readonly source: MediaElementAudioSourceNode;
  private readonly buffers = new Map<string, AudioBuffer>();
  private semitones = 0;
  private rate = 1;
  private pendingPosition: number | null = null;
  private generation = 0;
  private disposed = false;
  private playingRequested = false;
  private cancelMediaLoad: (() => void) | null = null;
  private readonly downloads = new AbortController();
  private peaks: readonly number[] = [];

  constructor(private readonly urls: TrackAudio) {
    super();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preservesPitch = false;
    this.source = Tone.getContext().createMediaElementSource(this.audio);
    Tone.connect(this.source, this.pitch);
    this.audio.onended = () => {
      this.playingRequested = false;
      this.emit('ended');
    };
    this.audio.onerror = () => this.emit('error');
  }

  async load(): Promise<void> {
    await this.switchSource(this.urls.musicMp3Url);
  }

  play(): void {
    if (!this.ready || this.disposed) return;
    this.playingRequested = true;
    const generation = this.generation;
    void Tone.start()
      .then(async () => {
        if (!this.wantsPlayback(generation)) return false;
        await this.audio.play();
        return true;
      })
      .then((started) => {
        if (!started) return;
        if (this.disposed || !this.playingRequested) this.audio.pause();
        else if (generation === this.generation) this.emit('playing');
      })
      .catch(() => {
        if (this.wantsPlayback(generation)) this.emit('error');
      });
  }

  private wantsPlayback(generation: number): boolean {
    return (
      !this.disposed && this.playingRequested && generation === this.generation
    );
  }

  pause(): void {
    this.playingRequested = false;
    this.audio.pause();
    this.emit('paused');
  }

  seek(seconds: number): void {
    if (!this.ready) this.pendingPosition = seconds;
    else this.audio.currentTime = seconds;
  }
  currentTime(): number {
    return this.pendingPosition ?? this.audio.currentTime;
  }
  duration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }
  waveform(): readonly number[] {
    return this.peaks;
  }

  setRate(rate: number): void {
    this.rate = rate;
    this.audio.playbackRate = rate;
    this.pitch.pitch = compensatedPitch(this.semitones, rate);
  }

  setTranspose(semitones: number): void {
    this.semitones = semitones;
    this.pitch.pitch = compensatedPitch(semitones, this.audio.playbackRate);
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  setVocalsOnly(vocals: boolean): void {
    void this.switchSource(
      vocals ? this.urls.vocalsMp3Url : this.urls.musicMp3Url,
    ).catch(() => {
      if (!this.disposed) this.emit('error');
    });
  }

  destroy(): void {
    this.disposed = true;
    this.ready = false;
    this.generation++;
    this.cancelMediaLoad?.();
    this.downloads.abort();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audio.onended = null;
    this.audio.onerror = null;
    this.source.disconnect();
    this.pitch.dispose();
    this.buffers.clear();
    this.clearListeners();
  }

  private async switchSource(url: string): Promise<void> {
    const generation = ++this.generation;
    this.cancelMediaLoad?.();
    this.pendingPosition = this.currentTime();
    this.ready = false;
    this.audio.pause();
    const buffer = this.buffers.get(url) ?? (await this.decode(url));
    if (this.disposed || generation !== this.generation) return;
    this.buffers.set(url, buffer);
    this.peaks = waveformPeaks(buffer.getChannelData(0));
    await this.loadMedia(url);
    if (this.disposed || generation !== this.generation) return;
    this.audio.currentTime = Math.min(
      this.pendingPosition ?? 0,
      buffer.duration,
    );
    this.pendingPosition = null;
    this.setRate(this.rate);
    this.ready = true;
    this.emit('ready');
    if (this.playingRequested) this.play();
  }

  private async decode(url: string): Promise<AudioBuffer> {
    const response = await fetch(url, { signal: this.downloads.signal });
    if (!response.ok) throw new Error('Audio download failed');
    return Tone.getContext().decodeAudioData(await response.arrayBuffer());
  }

  private loadMedia(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const clear = () => {
        this.cancelMediaLoad = null;
        this.audio.onloadedmetadata = null;
        this.audio.onerror = () => this.emit('error');
      };
      this.cancelMediaLoad = () => {
        clear();
        resolve();
      };
      this.audio.onloadedmetadata = () => {
        clear();
        resolve();
      };
      this.audio.onerror = () => {
        clear();
        this.emit('error');
        reject(new Error('Audio load failed'));
      };
      this.audio.src = url;
      this.audio.load();
    });
  }
}
