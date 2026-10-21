/** A card as the tracker reads it from the DOM. */
export type RowCardSource = {
  dataset: { homeItemId?: string; homeItemPosition?: string };
  getBoundingClientRect: () => {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
};

/** A home card as geometry: its id, position and rectangle. */
export type RowCardGeometry = {
  id: string;
  position: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** The cards of a row element as geometry, in DOM order. */
export function rowCardGeometries(rowElement: {
  querySelectorAll: (selector: string) => ArrayLike<RowCardSource>;
}): RowCardGeometry[] {
  return Array.from(rowElement.querySelectorAll('[data-home-item-id]')).map(
    (card, index) => {
      const rect = card.getBoundingClientRect();
      const position = Number(card.dataset.homeItemPosition ?? index);
      return {
        id: card.dataset.homeItemId ?? '',
        position: Number.isFinite(position) ? position : index,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
    },
  );
}

/** The viewport the cards are checked against. */
export type Viewport = { width: number; height: number };

/** A card on screen, with the position it is shown at. */
export type VisibleItem = { id: string; position: number };

/**
 * The cards of a row that are on screen: any overlap with the viewport
 * counts. The row itself is only reported once it is at least half visible
 * (an `IntersectionObserver` threshold where this runs), so this only narrows
 * a visible row down to the items the visitor can actually see.
 */
export function visibleRowItems(
  cards: readonly RowCardGeometry[],
  viewport: Viewport,
): VisibleItem[] {
  return cards
    .filter(
      (card) =>
        card.bottom > 0 &&
        card.top < viewport.height &&
        card.right > 0 &&
        card.left < viewport.width,
    )
    .map((card) => ({ id: card.id, position: card.position }));
}
