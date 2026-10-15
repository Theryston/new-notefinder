export type VoicePoint = { time: number; midi: number };

/** Readings further apart than this are not joined, whatever came between. */
const GAP_SECONDS = 0.15;

/** The oldest readings are dropped past this many, far more than fit on screen. */
const MAX_POINTS = 1500;

/** Seeking back further than this forgets the line drawn ahead of it. */
const REWIND_SECONDS = 0.25;

type Listener = () => void;

/**
 * The user's voice as the timeline draws it: readings placed on the Track's
 * time. A reading with no pitch ends the current stretch, so silence is a gap
 * and never an interpolated line. It
 * lives outside React, like the playback time, and tells the roll when to
 * redraw.
 */
export class VoiceTrail {
  /** `null` marks a reading with no pitch: the stretch before it ends there. */
  private points: (VoicePoint | null)[] = [];
  private lastTime = Number.NEGATIVE_INFINITY;
  private readonly listeners = new Set<Listener>();
  private latestMidi: number | null = null;

  /** Records the voice at `time`, the Track's moment (null: nothing voiced). */
  push(time: number, midi: number | null): void {
    this.latestMidi = midi;
    if (time < this.lastTime - REWIND_SECONDS) this.points = [];
    if (midi === null) {
      // One marker per silence is enough, and none before the first voice.
      if (this.points.length > 0 && this.points.at(-1) !== null) {
        this.points.push(null);
      }
    } else {
      this.points.push({ time, midi });
      this.lastTime = time;
    }
    if (this.points.length > MAX_POINTS) this.points.shift();
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
    this.lastTime = Number.NEGATIVE_INFINITY;
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
    const end = () => {
      if (current.length > 0) result.push(current);
      current = [];
    };
    for (const point of this.points) {
      const previous = current.at(-1);
      if (
        point === null ||
        (previous && point.time - previous.time > GAP_SECONDS)
      ) {
        end();
      }
      if (point) current.push(point);
    }
    end();
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
