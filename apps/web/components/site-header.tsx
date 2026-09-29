import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LogoMark } from '@/components/logo-mark';
import { Link } from '@/lib/i18n/navigation';

import { SiteHeaderFrame } from './site-header-frame';

/**
 * The glass bar on top of the site pages: the brand on the left, then the
 * `search` and `account` slots (filled by the layout, since shared
 * components don't reach into features).
 */
export function SiteHeader({
  search,
  account,
}: {
  search: ReactNode;
  account: ReactNode;
}) {
  const t = useTranslations('header');

  return (
    <>
      <a
        href="#main"
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm outline-none focus-visible:translate-y-0 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t('skipToContent')}
      </a>
      <SiteHeaderFrame>
        <div className="glass relative mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 rounded-full pr-2 pl-3 md:gap-4 md:pl-4">
          <Link
            href="/"
            aria-label={t('home')}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-1 py-1 outline-none transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogoMark className="size-7" />
            <span className="hidden font-bold text-xl tracking-tight md:inline">
              {t('wordmark')}
            </span>
          </Link>
          <div className="flex flex-1 items-center justify-end gap-1 md:gap-4">
            {search}
            {account}
          </div>
        </div>
      </SiteHeaderFrame>
    </>
  );
}
