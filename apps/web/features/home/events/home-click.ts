import type { ClickTarget } from './events-sender';
import type { HomeRowMeta } from './tracked-rows';

/**
 * The home click of an event target, if the click landed on a card link of a
 * tracked row: the card, its row, and the position it was shown at (absent
 * for the hero). Anything else (a link outside a row, an unknown row, a card
 * without an item) is not a home click.
 */
export function clickTargetOf(
  target: EventTarget | null,
  meta: Map<string, HomeRowMeta>,
): ClickTarget | undefined {
  const link = (target as Element | null)?.closest?.('a[href]');
  if (!link) return undefined;
  const rowId = (link.closest('[data-home-row-id]') as HTMLElement | null)
    ?.dataset.homeRowId;
  const row = rowId === undefined ? undefined : meta.get(rowId);
  if (rowId === undefined || row === undefined) return undefined;
  const card = link.closest('[data-home-item-id]') as HTMLElement | null;
  const itemId = card?.dataset.homeItemId;
  if (!itemId) return undefined;
  const rawPosition = Number(card?.dataset.homeItemPosition);
  return {
    ...row,
    rowId,
    itemId,
    ...(Number.isFinite(rawPosition) ? { position: rawPosition } : {}),
  };
}
