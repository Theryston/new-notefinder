import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';

import { SiteChrome } from '@/components/site-chrome';
import { AccountMenu } from '@/features/auth/components/account-menu';
import { HeaderSearch } from '@/features/search/components/header-search';
import { HeaderSearchFallback } from '@/features/search/components/header-search-bar';

/** Site pages (home, tracks, search, terms…): everything but auth. */
export default async function SiteLayout({
  children,
}: LayoutProps<'/[locale]'>) {
  const { errors, header } = await getMessages();

  return (
    // The header's client components need its messages; only site pages
    // pay for them.
    <NextIntlClientProvider messages={{ errors, header }}>
      <SiteChrome
        search={
          <Suspense fallback={<HeaderSearchFallback />}>
            <HeaderSearch />
          </Suspense>
        }
        account={<AccountMenu />}
      >
        {children}
      </SiteChrome>
    </NextIntlClientProvider>
  );
}
