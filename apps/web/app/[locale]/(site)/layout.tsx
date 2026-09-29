import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { SiteHeader } from '@/components/site-header';
import { AccountMenu } from '@/features/auth/components/account-menu';
import { MenuSkeleton } from '@/features/auth/components/menu-skeleton';
import { HeaderSearch } from '@/features/search/components/header-search';

/** Site pages (home, tracks, search, terms…): everything but auth. */
export default async function SiteLayout({
  children,
}: LayoutProps<'/[locale]'>) {
  const { errors, header } = await getMessages();

  return (
    // The header's client components need its messages; only site pages
    // pay for them.
    <NextIntlClientProvider messages={{ errors, header }}>
      <SiteHeader
        search={<HeaderSearch />}
        account={
          // It reads the pathname, which pages with params unknown at build
          // time (artists, albums) only have at request time.
          <Suspense fallback={<MenuSkeleton />}>
            <AccountMenu />
          </Suspense>
        }
      />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
