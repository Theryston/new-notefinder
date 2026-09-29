'use client';

import { type RefObject, useEffect, useState } from 'react';

import { nextScrollVisibility } from './scroll-visibility';

/**
 * Whether the element in `ref` (a sticky header) should slide away: hidden
 * while the user scrolls down, back on scroll up. Never hides with
 * `prefers-reduced-motion`, where the slide would be the motion to avoid.
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let state = { hidden: false, anchorY: window.scrollY };
    let frame = 0;

    const update = () => {
      frame = 0;
      const height = ref.current?.offsetHeight ?? 0;
      state = nextScrollVisibility(state, window.scrollY, height);
      setHidden(state.hidden && !reducedMotion.matches);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ref]);

  return hidden;
}
