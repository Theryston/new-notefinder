import type { HomeRow } from '@notefinder/contracts';
import type { ReactNode } from 'react';

import type { SponsoredPlacement } from '../components/sponsored-notice';
import { CarouselLayout } from './carousel-layout';
import { HeroLayout } from './hero-layout';
import { VocalRangeLayout } from './vocal-range-layout';

type LayoutOf<TLayout extends HomeRow['layout']> = Extract<
  HomeRow,
  { layout: TLayout }
>;

/** One registered layout: where its sponsored notice goes, and how it renders. */
export type HomeLayoutEntry = {
  placement: SponsoredPlacement;
  render: (row: HomeRow, priority: boolean) => ReactNode;
};

function isLayoutOf<TLayout extends HomeRow['layout']>(
  row: HomeRow,
  layout: TLayout,
): row is LayoutOf<TLayout> {
  return row.layout === layout;
}

/**
 * Binds a layout component to its name in the feed. The row is narrowed by
 * `layout` before the component sees it, so a component only ever gets its own
 * row shape.
 */
function registerLayout<TLayout extends HomeRow['layout']>(
  layout: TLayout,
  placement: SponsoredPlacement,
  Component: (props: {
    row: LayoutOf<TLayout>;
    priority: boolean;
  }) => ReactNode,
): HomeLayoutEntry {
  return {
    placement,
    render: (row, priority) =>
      isLayoutOf(row, layout) ? (
        <Component row={row} priority={priority} />
      ) : null,
  };
}

/**
 * Every layout the web can render, keyed by the feed's `layout` field. A new
 * layout is registered here and nowhere else; `layout-registry.test.ts`
 * renders each entry with `sponsored` on, so none can forget the notice.
 */
export const homeLayoutRegistry = {
  hero: registerLayout('hero', 'caption', HeroLayout),
  standard: registerLayout('standard', 'line', CarouselLayout),
  'vocal-range': registerLayout('vocal-range', 'line', VocalRangeLayout),
} satisfies Record<HomeRow['layout'], HomeLayoutEntry>;

/** Whether the web renders this layout; any other one is skipped. */
export const isRegisteredLayout = (
  layout: string,
): layout is HomeRow['layout'] => Object.hasOwn(homeLayoutRegistry, layout);
