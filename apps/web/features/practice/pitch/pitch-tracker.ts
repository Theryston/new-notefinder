import { resolveOctave } from './harmonic-evidence';
import { frequencyToMidi } from './post-process';
import type { PitchReading } from './yin';

type Evidence = {
  candidates: readonly PitchReading[];
  periodic: PitchReading | null;
  /** The center of the captured frame, in seconds, rather than inference time. */
  time: number;
  silent: boolean;
  /** Raw mono samples at the model's 16 kHz rate, for octave ambiguity. */
  frame?: Float32Array;
};

type Candidate = {
  midi: number;
  confidence: number;
  corroborated?: boolean;
};
type Pending = { midi: number; since: number; lastSeen: number };

const MODEL_CONFIDENCE = 0.5;
// Onsets have no continuity to support a diffuse, potentially unvoiced peak.
const ACQUIRE_CONFIDENCE = 0.75;
const PERIODIC_CONFIDENCE = 0.9;
const SUPPORTED_CONFIDENCE = 0.15;
const CONTINUING_CONFIDENCE = 0.3;
const AGREEMENT_SEMITONES = 0.75;
// Small motion stays continuous: do not round away vibrato or slide steps.
const CONTINUOUS_SEMITONES = 3;
// At a 32 ms hop, a sustained leap settles in 96 ms. Counting capture time
// prevents fast/duplicate callbacks from masquerading as sustained evidence.
const CONFIRM_SECONDS = 0.08;
const HOLD_SECONDS = 0.064;
const FORGET_SECONDS = 0.3;

function candidate(reading: PitchReading | null): Candidate | null {
  if (
    !reading ||
    !Number.isFinite(reading.frequency) ||
    reading.frequency <= 0 ||
    !Number.isFinite(reading.confidence) ||
    reading.confidence < 0 ||
    reading.confidence > 1
  ) {
    return null;
  }
  return {
    midi: frequencyToMidi(reading.frequency),
    confidence: reading.confidence,
  };
}

function strongest(candidates: readonly Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const value of candidates) {
    if (!best || value.confidence > best.confidence) best = value;
  }
  return best;
}

/** Two independent estimators agreeing can rescue a diffuse model peak. */
function select(evidence: Evidence): Candidate | null {
  const candidates = evidence.candidates.flatMap((reading) => {
    const value = candidate(reading);
    return value ? [value] : [];
  });
  const periodic = candidate(evidence.periodic);
  if (periodic && periodic.confidence >= PERIODIC_CONFIDENCE) {
    const supported = strongest(
      candidates.filter(
        (value) =>
          value.confidence >= SUPPORTED_CONFIDENCE &&
          Math.abs(value.midi - periodic.midi) <= AGREEMENT_SEMITONES,
      ),
    );
    if (supported) {
      return {
        ...supported,
        confidence: PERIODIC_CONFIDENCE,
        corroborated: true,
      };
    }
  }
  const model = strongest(candidates);
  if (model && model.confidence >= MODEL_CONFIDENCE) return model;
  return periodic && periodic.confidence >= PERIODIC_CONFIDENCE
    ? periodic
    : model;
}

/**
 * A causal voice track, independent of frame rate and musical key. Brief
 * uncertainty can retain a note; new large movements need consistent support.
 * An octave is resolved from waveform evidence, never from the song's key.
 */
export class PitchTracker {
  private reference: number | null = null;
  private acceptedAt = -Infinity;
  private lastTime = -Infinity;
  private pending: Pending | null = null;
  private velocity = 0;

  push(evidence: Evidence): number | null {
    const { time } = evidence;
    if (!Number.isFinite(time) || time <= this.lastTime) return null;
    this.lastTime = time;
    if (time - this.acceptedAt >= FORGET_SECONDS) this.reference = null;
    if (evidence.silent) {
      this.pending = null;
      this.velocity = 0;
      return null;
    }
    const value = this.choose(evidence);
    const continuous = value && this.continues(value.midi, time);
    const minimum =
      this.reference === null ? ACQUIRE_CONFIDENCE : CONTINUING_CONFIDENCE;
    if (
      !value ||
      value.confidence < minimum ||
      (value.confidence < MODEL_CONFIDENCE &&
        (!continuous || time - this.acceptedAt > HOLD_SECONDS))
    ) {
      this.pending = null;
      return this.hold(time);
    }
    if (
      this.reference === null ||
      continuous ||
      (value.corroborated && Math.abs(value.midi - this.reference) < 9)
    ) {
      return this.accept(value.midi, time);
    }
    return this.confirm(value.midi, time);
  }

  private choose(evidence: Evidence): Candidate | null {
    const value = select(evidence);
    if (!value || !evidence.frame || this.reference === null) return value;
    const midi = resolveOctave(evidence.frame, this.reference, value.midi);
    return midi === null ? value : { ...value, midi };
  }

  private accept(midi: number, time: number): number {
    const delta = this.reference === null ? 0 : midi - this.reference;
    const elapsed = time - this.acceptedAt;
    this.velocity =
      elapsed <= HOLD_SECONDS && Math.abs(delta) < 7 ? delta / elapsed : 0;
    this.reference = midi;
    this.acceptedAt = time;
    this.pending = null;
    return midi;
  }

  private continues(midi: number, time: number): boolean {
    if (this.reference === null) return false;
    const delta = midi - this.reference;
    if (Math.abs(delta) <= CONTINUOUS_SEMITONES) return true;
    const elapsed = time - this.acceptedAt;
    // A fast slide can accelerate through a weak model frame. Follow its
    // existing direction briefly, but never predict through an octave jump.
    const projected = this.velocity * elapsed;
    return (
      elapsed <= HOLD_SECONDS &&
      Math.abs(delta) < 7 &&
      delta * projected > 0 &&
      Math.abs(delta - projected) <= 1.5
    );
  }

  private hold(time: number): number | null {
    return time - this.acceptedAt <= HOLD_SECONDS + Number.EPSILON
      ? this.reference
      : null;
  }

  private confirm(midi: number, time: number): number | null {
    if (
      !this.pending ||
      time - this.pending.lastSeen > HOLD_SECONDS + Number.EPSILON ||
      Math.abs(midi - this.pending.midi) > AGREEMENT_SEMITONES
    ) {
      this.pending = { midi, since: time, lastSeen: time };
    }
    this.pending.midi = midi;
    this.pending.lastSeen = time;
    if (time - this.pending.since >= CONFIRM_SECONDS) {
      return this.accept(midi, time);
    }
    return this.hold(time);
  }
}
