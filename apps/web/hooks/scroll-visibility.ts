/** Scrolled less than this since the last change keeps the header as it is. */
const THRESHOLD_PX = 8;

export type ScrollVisibility = {
  hidden: boolean;
  /** `scrollY` the next scroll is compared with. */
  anchorY: number;
};

/**
 * Whether a header that hides on scroll should be hidden at `currentY`:
 * hidden while scrolling down, shown again as soon as the user scrolls up,
 * and always shown within `headerHeight` of the top. Small movements
 * (trackpad jitter, momentum) don't flip it.
 */
export function nextScrollVisibility(
  previous: ScrollVisibility,
  currentY: number,
  headerHeight: number,
): ScrollVisibility {
  if (currentY <= headerHeight) return { hidden: false, anchorY: currentY };
  const delta = currentY - previous.anchorY;
  if (delta >= THRESHOLD_PX) return { hidden: true, anchorY: currentY };
  if (delta <= -THRESHOLD_PX) return { hidden: false, anchorY: currentY };
  return previous;
}
