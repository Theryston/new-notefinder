/**
 * The timeline's box: as tall as the screen leaves room for under the dock
 * (`--dock-height`, published by the dock), between 12rem and 26rem. The
 * 19.25rem covers the site header, title, listening tools and gaps. The `md`
 * copy overrides the roll's own default height at that width. Written out in
 * full because Tailwind finds classes by scanning the source for them.
 */
export const TIMELINE_BOX_CLASS =
  'h-[clamp(12rem,calc(100svh-var(--dock-height,0px)-19.25rem),26rem)] w-full rounded-2xl md:h-[clamp(12rem,calc(100svh-var(--dock-height,0px)-19.25rem),26rem)]';
