'use client';

import { ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

/** The admin sections: one card per area, each a real link to its page. */
export function AdminIndexCards() {
  const t = useTranslations('admin');
  return (
    <ul className="flex flex-col gap-3 py-2">
      <li>
        <Link
          href="/admin/home-pins"
          className="flex items-center justify-between gap-4 rounded-2xl border bg-card px-5 py-4 shadow-xs outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex min-w-0 flex-col">
            <span className="font-bold text-lg tracking-tight">
              {t('cards.homePins.title')}
            </span>
            <span className="text-muted-foreground text-sm">
              {t('cards.homePins.description')}
            </span>
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        </Link>
      </li>
    </ul>
  );
}
