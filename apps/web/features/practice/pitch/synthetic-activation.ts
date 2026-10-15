// A model answer for the tests: a bump around the bin CREPE names for a pitch.
/** An activation with a bump around the bin CREPE would name for `frequency`. */
export function activationFor(frequency: number, strength = 0.9): Float32Array {
  const cents = 1200 * Math.log2(frequency / 10);
  const center = Math.round((cents - 1997.3794084376191) / 20);
  const activation = new Float32Array(360);
  activation[center] = strength;
  activation[center - 1] = strength / 3;
  activation[center + 1] = strength / 3;
  return activation;
}
