import { describe, expect, it, vi } from 'vitest';

import { coalesceToFrame } from './frame-coalescer';

/** A scheduler the test steps by hand, one frame at a time. */
function manualFrames() {
  const queue = new Map<number, () => void>();
  let next = 1;
  return {
    request: (callback: () => void) => {
      queue.set(next, callback);
      return next++;
    },
    cancel: (handle: number) => void queue.delete(handle),
    runFrame: () => {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback();
    },
    pending: () => queue.size,
  };
}

describe('coalesceToFrame', () => {
  it('draws once per frame however many readings come before it', () => {
    const frames = manualFrames();
    const paint = vi.fn();
    const { schedule } = coalesceToFrame(paint, frames);
    for (let reading = 0; reading < 5; reading += 1) schedule();
    expect(paint).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(1);

    frames.runFrame();
    expect(paint).toHaveBeenCalledOnce();
  });

  it('draws again for readings of the next frame', () => {
    const frames = manualFrames();
    const paint = vi.fn();
    const { schedule } = coalesceToFrame(paint, frames);
    schedule();
    frames.runFrame();
    schedule();
    schedule();
    frames.runFrame();
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('draws nothing once cancelled', () => {
    const frames = manualFrames();
    const paint = vi.fn();
    const { schedule, cancel } = coalesceToFrame(paint, frames);
    schedule();
    cancel();
    frames.runFrame();
    expect(paint).not.toHaveBeenCalled();
  });

  it('can be scheduled again after a cancel', () => {
    const frames = manualFrames();
    const paint = vi.fn();
    const { schedule, cancel } = coalesceToFrame(paint, frames);
    schedule();
    cancel();
    schedule();
    frames.runFrame();
    expect(paint).toHaveBeenCalledOnce();
  });
});
