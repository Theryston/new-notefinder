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

// The link is the touch target: its padding makes it 40px tall or more, and
// the negative margins keep the line's layout exactly as the text alone.
// Padding is 12px top and bottom, so the caption (20px line) reaches 44px and
// the line (16px line) reaches 40px.
const HIT_AREA_CLASS =
  '-my-3 inline-block self-start rounded-md px-1 py-3 outline-none transition-colors duration-150 ease-out focus-visible:ring-3';

const HIT_AREA_FOCUS: Record<SponsoredPlacement, string> = {
  // White on the orange hero: 3.5:1 against the orange.
  caption: 'focus-visible:ring-primary-foreground',
  // Orange on the page background: 3.5:1 on white, more on dark.
  line: 'focus-visible:ring-ring',
};

const TEXT_CLASS: Record<SponsoredPlacement, string> = {
  // The darker scrim lifts white text on the orange to about 5.7:1.
  caption:
    'rounded-md bg-hero-scrim px-2 font-medium text-primary-foreground text-sm group-hover:underline',
  line: 'font-medium text-muted-foreground text-xs group-hover:text-foreground group-hover:underline',
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
      className={cn('group', HIT_AREA_CLASS, HIT_AREA_FOCUS[placement])}
    >
      <span className={TEXT_CLASS[placement]}>{text}</span>
    </Link>
  );
}
