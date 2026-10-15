/**
 * Brings the mic's samples down to the model's rate. Each output sample is
 * the average of the input samples it covers, which is enough of a low-pass
 * for a singing voice (its fundamental is far below the model's Nyquist), and
 * it keeps working across blocks of any size.
 */
export class Downsampler {
  private readonly step: number;
  private position = 0;
  private sum = 0;
  private count = 0;

  constructor(fromRate: number, toRate: number) {
    this.step = fromRate / toRate;
  }

  push(block: Float32Array): Float32Array {
    const out: number[] = [];
    for (const sample of block) {
      this.sum += sample;
      this.count += 1;
      this.position += 1;
      if (this.position >= this.step) {
        out.push(this.sum / this.count);
        this.position -= this.step;
        this.sum = 0;
        this.count = 0;
      }
    }
    return Float32Array.from(out);
  }
}
