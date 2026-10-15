export type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
};

/**
 * Runs `callback` at most once per animation frame, however many times
 * `schedule` is called before the frame comes. The voice is read many times a
 * frame; the canvas is drawn once.
 */
export function coalesceToFrame(
  callback: () => void,
  frames: FrameScheduler,
): { schedule: () => void; cancel: () => void } {
  let pending: number | null = null;
  return {
    schedule: () => {
      if (pending !== null) return;
      pending = frames.request(() => {
        pending = null;
        callback();
      });
    },
    cancel: () => {
      if (pending !== null) frames.cancel(pending);
      pending = null;
    },
  };
}
