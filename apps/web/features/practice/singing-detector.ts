import { FORGET_AFTER } from './pitch/post-process';

/**
 * Tells whether the User is singing from the readings of the pitch engine: a
 * reading with a voice means singing, and a breath or a dropped note stays
 * singing until the same run of unvoiced readings the smoothing forgets a note
 * after. Counting readings (not time) keeps it in step with the detector frames.
 */
export class SingingDetector {
  /** Starts silent, so nothing counts until a voice is heard. */
  private unvoiced = FORGET_AFTER;

  /** Feeds one reading (`null`: nothing voiced) and says if the User is singing. */
  push(midi: number | null): boolean {
    this.unvoiced = midi === null ? this.unvoiced + 1 : 0;
    return this.unvoiced < FORGET_AFTER;
  }
}
