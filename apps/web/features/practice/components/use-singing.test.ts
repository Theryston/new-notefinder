import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORGET_AFTER } from '../pitch/post-process';
import type { MicState } from '../stores/mic-store';
import { voiceTrail } from '../voice-trail';
import { useSinging } from './use-singing';

type MicStatus = MicState['status'];

const lifecycle = vi.hoisted(() => ({
  micStatus: 'off' as MicStatus,
  singing: false,
  deps: undefined as unknown[] | undefined,
  dispose: undefined as (() => void) | undefined,
}));

vi.mock('react', () => ({
  useState: () => [
    lifecycle.singing,
    (value: boolean) => {
      lifecycle.singing = value;
    },
  ],
  // Runs the effect only when its dependencies change, as React does.
  useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
    const unchanged =
      lifecycle.deps !== undefined &&
      deps.length === lifecycle.deps.length &&
      deps.every((dep, index) => dep === lifecycle.deps?.[index]);
    if (unchanged) return;
    lifecycle.dispose?.();
    lifecycle.deps = deps;
    lifecycle.dispose = effect() ?? undefined;
  },
}));
vi.mock('../stores/mic-store', () => ({
  useMicState: (selector: (state: { status: MicStatus }) => unknown) =>
    selector({ status: lifecycle.micStatus }),
}));

/** One render of the component with the mic in `status`. */
function useSingingWith(status: MicStatus): boolean {
  lifecycle.micStatus = status;
  return useSinging();
}

beforeEach(() => {
  lifecycle.singing = false;
});
afterEach(() => {
  lifecycle.dispose?.();
  lifecycle.dispose = undefined;
  lifecycle.deps = undefined;
  voiceTrail.clear();
});

describe('useSinging', () => {
  it('is not singing while the mic is off, even when a voice is placed', () => {
    useSingingWith('off');
    voiceTrail.push(1, 64);
    expect(useSingingWith('off')).toBe(false);
  });

  it('is not singing while the mic is still starting', () => {
    useSingingWith('starting');
    voiceTrail.push(1, 64);
    expect(useSingingWith('starting')).toBe(false);
  });

  it('is singing once a voice is heard with the mic on', () => {
    useSingingWith('on');
    voiceTrail.setLatest(64);
    expect(useSingingWith('on')).toBe(true);
  });

  it('stops singing once the voice has been silent for the forgetting run', () => {
    useSingingWith('on');
    voiceTrail.setLatest(64);
    for (let reading = 0; reading < FORGET_AFTER; reading += 1) {
      voiceTrail.setLatest(null);
    }
    expect(useSingingWith('on')).toBe(false);
  });

  it('is no longer singing after the mic is turned off', () => {
    useSingingWith('on');
    voiceTrail.setLatest(64);
    expect(useSingingWith('on')).toBe(true);
    expect(useSingingWith('off')).toBe(false);
    voiceTrail.setLatest(62);
    expect(useSingingWith('off')).toBe(false);
  });
});
