import type { HomeHero } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { Link } from '@/lib/i18n/navigation';
import { creditText } from '@/lib/track-credit';
import { cn } from '@/lib/utils';
import { SponsoredNotice } from '../components/sponsored-notice';
import { HERO_BLOCK_CLASS, HERO_COVER_SIZES } from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';

const COVER_CLASS =
  'absolute top-6 right-6 aspect-square w-32 overflow-hidden rounded-2xl shadow-xl md:top-1/2 md:right-10 md:w-56 md:-translate-y-1/2 lg:w-64';

const CTA_CLASS =
  'inline-flex items-center rounded-full bg-background px-5 py-2.5 font-semibold text-foreground text-sm shadow-xs transition-transform duration-200 ease-spring active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-primary-foreground outline-none';

/**
 * The feed's featured Track: one solid orange block with the cover at its
 * corner, the title in display type and one pill that opens the Track. The
 * sponsored notice, when set, is a caption above the title.
 */
export function HeroLayout({
  row,
  priority,
}: {
  row: HomeHero;
  priority: boolean;
}) {
  const t = useTranslations('home.hero');
  const { track } = row;
  const headingId = rowHeadingId(row.id);
  return (
    <section
      aria-labelledby={headingId}
      data-home-row-id={row.id}
      className={cn(
        'relative isolate flex items-end overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground md:p-10',
        HERO_BLOCK_CLASS,
      )}
    >
      <div aria-hidden="true" className={COVER_CLASS}>
        <TrackCoverArt
          coverArtUrl={track.coverUrl}
          placeholderSeed={track.id}
          sizes={HERO_COVER_SIZES}
          priority={priority}
        />
      </div>
      <div className="relative flex max-w-md flex-col items-start gap-3">
        {row.sponsored ? <SponsoredNotice placement="caption" /> : null}
        <h2
          id={headingId}
          className="font-extrabold text-4xl tracking-tighter md:text-5xl"
        >
          {track.title}
        </h2>
        <p className="font-semibold text-sm">
          {creditText(track.artistCredit)}
        </p>
        <Link
          href={`/tracks/${track.id}`}
          className={CTA_CLASS}
          data-home-item-id={track.id}
        >
          {t('sing')}
        </Link>
      </div>
    </section>
  );
}
