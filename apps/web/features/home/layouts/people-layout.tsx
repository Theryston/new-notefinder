import type { HomePeopleRow } from '@notefinder/contracts';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Link } from '@/lib/i18n/navigation';
import { CarouselScroller } from '../components/carousel-scroller';
import { SponsoredNotice } from '../components/sponsored-notice';
import {
  CAROUSEL_HEADER_CLASS,
  CAROUSEL_TITLE_CLASS,
} from '../layout-dimensions';
import { rowHeadingId } from '../row-heading-id';
import { isHomeRowTitleKey } from '../row-titles';

/** Public Profiles sharing a listener's songs, shown with a link to each Profile. */
export function PeopleLayout({
  row,
}: {
  row: HomePeopleRow;
  priority: boolean;
}) {
  const t = useTranslations();
  const { key, params } = row.title;
  if (!isHomeRowTitleKey(key)) return null;
  const headingId = rowHeadingId(row.id);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <CarouselScroller
        header={
          <div className={CAROUSEL_HEADER_CLASS}>
            <h2 id={headingId} className={CAROUSEL_TITLE_CLASS}>
              {t(key, params)}
            </h2>
            {row.sponsored ? <SponsoredNotice placement="line" /> : null}
          </div>
        }
      >
        {row.items.map((person) => (
          <li key={person.id} className="w-32 shrink-0 md:w-36">
            <Link
              href={`/users/${person.username}`}
              className="group flex h-full flex-col items-center gap-2 rounded-2xl p-2 text-center outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Avatar className="size-20 border border-border md:size-24">
                {/* Stored Google and legacy Avatar URLs may not match the optimizer hosts. */}
                {person.image ? (
                  <AvatarImage
                    keepMounted
                    render={
                      <Image
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 80px, 96px"
                        src={person.image}
                        alt=""
                      />
                    }
                    src={person.image}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="bg-primary/15 font-semibold text-primary">
                  {person.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="w-full truncate font-medium text-sm">
                {person.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {t('home.people.commonTracks', { count: person.commonTracks })}
              </span>
            </Link>
          </li>
        ))}
      </CarouselScroller>
    </section>
  );
}
