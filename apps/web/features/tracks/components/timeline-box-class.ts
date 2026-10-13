/**
 * The timeline's box: as tall as the screen leaves room for under the dock
 * (`--dock-height`, published by the dock), between 12rem and 26rem. The 16rem
 * is the site header, the title row and the gaps around the roll. The `md`
 * copy overrides the roll's own default height at that width. Written out in
 * full because Tailwind finds classes by scanning the source for them.
 */
export const TIMELINE_BOX_CLASS =
  'h-[clamp(12rem,calc(100svh-var(--dock-height,0px)-16rem),26rem)] w-full rounded-2xl md:h-[clamp(12rem,calc(100svh-var(--dock-height,0px)-16rem),26rem)]';
