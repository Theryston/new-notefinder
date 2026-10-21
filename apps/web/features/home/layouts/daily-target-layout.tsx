import type { HomeDailyTargetRow } from '@notefinder/contracts';
import { FlameIcon, TargetIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SponsoredNotice } from '../components/sponsored-notice';
import { dailyTargetCopy } from '../daily-target-copy';
import {
  CAROUSEL_TITLE_CLASS,
  DAILY_TARGET_STRIP_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/**
 * The daily target strip: a thin bar with the practice time left today and
 * the User's streak. A key this web doesn't know hides the strip rather than
 * showing a raw key. The sponsored notice, when set, sits under the bar like
 * on every row layout. `priority` only positions the strip in the registry's
 * shared signature; the strip has no images to load eagerly.
 */
export function DailyTargetLayout(props: {
  row: HomeDailyTargetRow;
  priority: boolean;
}) {
  const { row } = props;
  const t = useTranslations();
  const { key, params } = dailyTargetCopy(row);
  const streak = useTranslations('home.dailyTarget');
  if (!isHomeRowTitleKey(row.title.key)) return null;
  const headingId = rowHeadingId(row.id);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className={CAROUSEL_TITLE_CLASS}>
        {t(row.title.key, row.title.params)}
      </h2>
      <div className={DAILY_TARGET_STRIP_CLASS}>
        <p className="flex min-w-0 items-center gap-2 font-medium text-sm">
          <TargetIcon
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={1.75}
          />
          <span className="truncate">{t(key, params)}</span>
        </p>
        <p className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-3 py-1 font-semibold text-xs">
          <FlameIcon
            aria-hidden="true"
            className="size-3.5"
            strokeWidth={1.75}
          />
          {streak('streak', { days: row.streakDays })}
        </p>
      </div>
      {row.sponsored ? <SponsoredNotice placement="line" /> : null}
    </section>
  );
}
