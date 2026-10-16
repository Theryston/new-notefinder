type Reading = { midi: number | null; lagSeconds: number; at: number };
type Listener = (reading: Reading) => void;
const listeners = new Set<Listener>();

/** Observes completed readings only; never changes the mic's computation. */
export function observeCalibrationReading(
  midi: number | null,
  lagSeconds: number,
): void {
  if (listeners.size === 0) return;
  const reading = { midi, lagSeconds, at: performance.now() / 1000 };
  for (const listener of listeners) listener(reading);
}

export function watchCalibrationReading(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
