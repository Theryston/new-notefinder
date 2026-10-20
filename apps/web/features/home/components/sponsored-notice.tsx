import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { TERMS_ADVERTISING_FRAGMENT } from '@/lib/terms-fragments';
import { cn } from '@/lib/utils';

/**
 * Where the notice sits in its layout. Each layout picks one in the registry
 * (`layouts/layout-registry.tsx`): a hero shows a caption inside its text
 * block, every row layout a muted line under its title.
 */
export type SponsoredPlacement = 'caption' | 'line';

// Negative margins with matching padding: the hit area reaches 40px tall
// (the touch target) while the text keeps its discreet size and spacing.
const HIT_AREA_CLASS =
  '-my-2 inline-flex items-center rounded-md px-1 py-2 outline-none transition-colors duration-150 ease-out focus-visible:ring-3';

const PLACEMENT_CLASS: Record<SponsoredPlacement, string> = {
  // White on the orange hero needs a darker backing to reach 4.5:1 at this size.
  caption:
    'self-start rounded-md bg-black/25 px-2 font-medium text-sm text-primary-foreground underline-offset-4 hover:underline focus-visible:ring-primary-foreground/70',
  line: 'self-start font-medium text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-ring/50',
};

/**
 * The discreet "sponsored" notice: plain text that links to the advertising
 * section of the terms of use. Shared by every layout, so the wording, the
 * link and the focus state are the same wherever it appears.
 */
export function SponsoredNotice({
  placement,
}: {
  placement: SponsoredPlacement;
}) {
  const t = useTranslations('home.sponsored');
  const text = placement === 'caption' ? t('hero') : t('row');
  return (
    <Link
      href={`/terms#${TERMS_ADVERTISING_FRAGMENT}`}
      className={cn(HIT_AREA_CLASS, PLACEMENT_CLASS[placement])}
    >
      {text}
    </Link>
  );
}
