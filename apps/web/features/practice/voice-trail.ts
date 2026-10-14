export type VoicePoint = { time: number; midi: number };

/** Readings further apart than this are not joined by a line. */
const GAP_SECONDS = 0.15;

/** The oldest readings are dropped past this many, far more than fit on screen. */
const MAX_POINTS = 1500;

/** Seeking back further than this forgets the line drawn ahead of it. */
const REWIND_SECONDS = 0.25;

type Listener = () => void;

/**
 * The user's voice as the timeline draws it: readings placed on the Track's
 * time. A reading with no pitch leaves a gap, never an interpolated line. It
 * lives outside React, like the playback time, and tells the roll when to
 * redraw.
 */
export class VoiceTrail {
  private points: VoicePoint[] = [];
  private readonly listeners = new Set<Listener>();
  private latestMidi: number | null = null;

  /** Records the voice at `time`, the Track's moment (null: nothing voiced). */
  push(time: number, midi: number | null): void {
    this.latestMidi = midi;
    const last = this.points.at(-1);
    if (last && time < last.time - REWIND_SECONDS) this.points = [];
    if (midi !== null) {
      this.points.push({ time, midi });
      if (this.points.length > MAX_POINTS) this.points.shift();
    }
    this.notify();
  }

  /** The newest reading, even when paused and nothing is placed on the roll. */
  setLatest(midi: number | null): void {
    this.latestMidi = midi;
    this.notify();
  }

  /** The note being sung right now as a fractional MIDI number, or null. */
  latest(): number | null {
    return this.latestMidi;
  }

  clear(): void {
    this.points = [];
    this.latestMidi = null;
    this.notify();
  }

  /**
   * The connected stretches of voice between `from` and `to`. A stretch ends
   * where readings are further apart than {@link GAP_SECONDS}, which is how
   * silence shows as a gap without storing it.
   */
  segments(from: number, to: number): VoicePoint[][] {
    const result: VoicePoint[][] = [];
    let current: VoicePoint[] = [];
    for (const point of this.points) {
      const previous = current.at(-1);
      if (previous && point.time - previous.time > GAP_SECONDS) {
        result.push(current);
        current = [];
      }
      current.push(point);
    }
    if (current.length > 0) result.push(current);
    return result.filter((segment) => {
      const first = segment[0];
      const last = segment.at(-1);
      return first && last && last.time >= from && first.time <= to;
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** One page, one mic: the trail the timeline and the readout share. */
export const voiceTrail = new VoiceTrail();
