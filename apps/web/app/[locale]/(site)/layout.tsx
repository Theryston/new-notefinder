import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { SiteHeader } from '@/components/site-header';
import { AccountMenu } from '@/features/auth/components/account-menu';
import { HeaderSearch } from '@/features/search/components/header-search';

/** Site pages (home, tracks, search…): everything but auth and the terms. */
export default async function SiteLayout({
  children,
}: LayoutProps<'/[locale]'>) {
  const { errors, header } = await getMessages();

  return (
    // The header's client components need its messages; only site pages
    // pay for them.
    <NextIntlClientProvider messages={{ errors, header }}>
      <SiteHeader search={<HeaderSearch />} account={<AccountMenu />} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
