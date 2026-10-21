/**
 * Outer sizes of the home's blocks, shared by the rows and their skeletons so
 * a skeleton reserves exactly the space its final content takes (no shift).
 */

export const HERO_BLOCK_CLASS = 'min-h-72 md:min-h-80';

export const CAROUSEL_HEADER_CLASS = 'flex min-h-14 flex-col justify-end';

export const CAROUSEL_TITLE_CLASS = 'font-bold text-xl tracking-tight';

/** The title's skeleton: one text-xl line (28px, `h-7`) of a typical title width. */
export const CAROUSEL_TITLE_SKELETON_CLASS = 'h-7 w-56 rounded-md';

/** One carousel card: the same width as a `TrackCard` in a snap track. */
export const CAROUSEL_ITEM_CLASS = 'w-40 shrink-0 snap-start sm:w-44 md:w-48';

export const CAROUSEL_TRACK_CLASS =
  '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** Sizes hint for a carousel cover: its rendered width at each breakpoint. */
export const CAROUSEL_COVER_SIZES =
  '(max-width: 640px) 160px, (max-width: 768px) 176px, 192px';

/** Sizes hint for the hero's cover, which takes the block's right half. */
export const HERO_COVER_SIZES = '(max-width: 768px) 50vw, 40vw';

/**
 * The daily target strip: one thin bar with the time left and the streak, so
 * the skeleton reserves exactly its height (no shift when it lands).
 */
export const DAILY_TARGET_STRIP_CLASS =
  'flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3';
