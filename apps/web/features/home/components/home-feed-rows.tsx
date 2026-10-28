import type { HomeRow } from '@vozzify/contracts';

import {
  homeLayoutRegistry,
  isRegisteredLayout,
} from '../layouts/layout-registry';
import { visibleRows } from '../visible-rows';

/** Renders known feed rows without pagination or engagement tracking. */
export function HomeFeedRows({ rows }: { rows: HomeRow[] }) {
  const visible = visibleRows(rows, isRegisteredLayout);
  return (
    <div className="flex flex-col gap-8 py-2">
      {visible.map((row, index) => (
        <div key={row.id} data-home-row-id={row.id}>
          {homeLayoutRegistry[row.layout].render(row, index === 0)}
        </div>
      ))}
    </div>
  );
}
